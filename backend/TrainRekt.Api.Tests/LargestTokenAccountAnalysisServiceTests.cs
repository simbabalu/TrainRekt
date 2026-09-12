using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Tests;

public sealed class LargestTokenAccountAnalysisServiceTests
{
    private sealed class FixedAddressPumpFunClassifier : ITokenAccountClassifier
    {
        private readonly string _address;

        public FixedAddressPumpFunClassifier(string address)
        {
            _address = address;
        }

        public ValueTask<TokenAccountClassification?> TryClassifyAsync(
            TokenAccountClassificationContext context,
            CancellationToken cancellationToken)
        {
            if (!string.Equals(context.TokenAccountAddress, _address, StringComparison.Ordinal))
            {
                return ValueTask.FromResult<TokenAccountClassification?>(null);
            }

            var classification = new TokenAccountClassification(
                Classification: TokenAccountClassificationConstants.BondingCurve,
                Protocol: ProtocolConstants.PumpFunProtocolName,
                Confidence: TokenAccountClassificationConstants.Verified,
                Evidence: Array.Empty<TokenAccountClassificationEvidence>());

            return ValueTask.FromResult<TokenAccountClassification?>(classification);
        }
    }

    private sealed class FakeHeliusClient : IHeliusClient
    {
        private readonly Dictionary<string, Queue<string>> _responsesByMethod = new(StringComparer.Ordinal);

        public void Enqueue(string method, string json)
        {
            if (!_responsesByMethod.TryGetValue(method, out var queue))
            {
                queue = new Queue<string>();
                _responsesByMethod[method] = queue;
            }

            queue.Enqueue(json);
        }

        public HttpRequestMessage CreateRpcPostRequest(string jsonRpcPayload)
        {
            return new HttpRequestMessage(HttpMethod.Post, "https://localhost")
            {
                Content = new StringContent(jsonRpcPayload)
            };
        }

        public Task<JsonDocument> SendRpcRequestAsync(string method, IReadOnlyList<object?> parameters, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (!_responsesByMethod.TryGetValue(method, out var queue) || queue.Count == 0)
            {
                throw new InvalidOperationException($"Missing fake response for method {method}");
            }

            return Task.FromResult(JsonDocument.Parse(queue.Dequeue()));
        }
    }

    [Fact]
    public async Task AnalyzeAsync_MalformedLargestAccountsPayload_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var accountReader = new ScopedSolanaAccountReader(fakeClient);
        var classificationService = new TokenAccountClassificationService(Array.Empty<ITokenAccountClassifier>());
        var service = new LargestTokenAccountAnalysisService(fakeClient, accountReader, classificationService);

        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"not-a-number\"}]}}");

        var result = await service.AnalyzeAsync(
            "So11111111111111111111111111111111111111112",
            SolanaTokenConstants.SplTokenProgramId,
            1_000_000,
            CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task AnalyzeAsync_ValidLargestAccounts_ReturnsBalancesAndUnknownClassification()
    {
        var fakeClient = new FakeHeliusClient();
        var accountReader = new ScopedSolanaAccountReader(fakeClient);
        var classificationService = new TokenAccountClassificationService(Array.Empty<ITokenAccountClassifier>());
        var service = new LargestTokenAccountAnalysisService(fakeClient, accountReader, classificationService);

        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"address\":\"acct1\",\"amount\":\"500000\"}]}}");

        var result = await service.AnalyzeAsync(
            "So11111111111111111111111111111111111111112",
            SolanaTokenConstants.SplTokenProgramId,
            1_000_000,
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Single(result.LargestAccountBalances);
        Assert.Equal((ulong)500000, result.LargestAccountBalances[0]);
        Assert.Single(result.LargestTokenAccounts);
        Assert.Equal(TokenAccountClassificationConstants.Unknown, result.LargestTokenAccounts[0].Classification.Classification);
    }

    [Fact]
    public async Task AnalyzeAsync_ZeroBalanceEntries_AreFilteredFromExposedLargestTokenAccounts()
    {
        var fakeClient = new FakeHeliusClient();
        var accountReader = new ScopedSolanaAccountReader(fakeClient);
        var classificationService = new TokenAccountClassificationService(Array.Empty<ITokenAccountClassifier>());
        var service = new LargestTokenAccountAnalysisService(fakeClient, accountReader, classificationService);

        fakeClient.Enqueue(
            "getTokenLargestAccounts",
            "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"address\":\"acct1\",\"amount\":\"500000\"},{\"address\":\"acct2\",\"amount\":\"0\"},{\"address\":\"acct3\",\"amount\":\"100000\"}]}}");

        var result = await service.AnalyzeAsync(
            "So11111111111111111111111111111111111111112",
            SolanaTokenConstants.SplTokenProgramId,
            1_000_000,
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(new ulong[] { 500_000, 0, 100_000 }, result.LargestAccountBalances);
        Assert.Equal(2, result.LargestTokenAccounts.Count);
        Assert.DoesNotContain(result.LargestTokenAccounts, account => account.RawAmount == "0");
        Assert.Equal(60m, result.UnclassifiedTokenAccountConcentration.UnknownPercentageWithinReportedLargestAccounts);
    }

    [Fact]
    public async Task AnalyzeAsync_ZeroBalanceBondingCurveStillContributesToPumpFunContext()
    {
        const string zeroBalanceAddress = "acct-zero";

        var fakeClient = new FakeHeliusClient();
        var accountReader = new ScopedSolanaAccountReader(fakeClient);
        var classificationService = new TokenAccountClassificationService(new ITokenAccountClassifier[]
        {
            new FixedAddressPumpFunClassifier(zeroBalanceAddress)
        });

        var service = new LargestTokenAccountAnalysisService(fakeClient, accountReader, classificationService);

        fakeClient.Enqueue(
            "getTokenLargestAccounts",
            "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"address\":\"acct-nonzero\",\"amount\":\"500000\"},{\"address\":\"acct-zero\",\"amount\":\"0\"}]}}");
        fakeClient.Enqueue("getAccountInfo", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":null}}");
        fakeClient.Enqueue("getAccountInfo", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":null}}");
        fakeClient.Enqueue("getAccountInfo", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":null}}");

        var result = await service.AnalyzeAsync(
            "So11111111111111111111111111111111111111112",
            SolanaTokenConstants.SplTokenProgramId,
            1_000_000,
            CancellationToken.None);

        Assert.NotNull(result);
        Assert.Single(result.LargestTokenAccounts);
        Assert.DoesNotContain(result.LargestTokenAccounts, account => account.Address == zeroBalanceAddress);
        Assert.NotNull(result.PumpFunContext);
        Assert.True(result.PumpFunContext.BondingCurveDetected);
    }
}
