using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Tests;

public sealed class LargestTokenAccountAnalysisServiceTests
{
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
        var classificationService = new TokenAccountClassificationService(Array.Empty<ITokenAccountClassifier>());
        var service = new LargestTokenAccountAnalysisService(fakeClient, classificationService);

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
        var classificationService = new TokenAccountClassificationService(Array.Empty<ITokenAccountClassifier>());
        var service = new LargestTokenAccountAnalysisService(fakeClient, classificationService);

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
}
