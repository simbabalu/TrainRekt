using System.Buffers.Binary;
using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Tests;

public sealed class TokenInspectionUsdcFixtureTests
{
    private sealed class FixtureHeliusClient : IHeliusClient
    {
        private readonly Dictionary<string, Queue<JsonDocument>> _responsesByMethod = new(StringComparer.Ordinal);

        public void Enqueue(string method, JsonDocument payload)
        {
            if (!_responsesByMethod.TryGetValue(method, out var queue))
            {
                queue = new Queue<JsonDocument>();
                _responsesByMethod[method] = queue;
            }

            queue.Enqueue(payload);
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
                throw new InvalidOperationException($"No fixture response available for method {method}.");
            }

            return Task.FromResult(queue.Dequeue());
        }
    }

    [Fact]
    public async Task InspectAsync_UsdcLikeFixtures_ReturnsSuccess()
    {
        var fixtureClient = new FixtureHeliusClient();
        var service = new TokenInspectionService(fixtureClient);
        const string usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

        var mintData = CreateMintData(
            supply: 100_000_000_000_000UL,
            decimals: 6,
            hasMintAuthority: false,
            hasFreezeAuthority: true);

        fixtureClient.Enqueue("getAccountInfo", JsonDocument.Parse($"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"],\"executable\":false,\"lamports\":1461600}}}}}}"));
        fixtureClient.Enqueue("getTokenLargestAccounts", JsonDocument.Parse("{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"address\":\"a\",\"amount\":\"20000000000000\",\"decimals\":6,\"uiAmount\":20000000.0,\"uiAmountString\":\"20000000\"},{\"address\":\"b\",\"amount\":\"10000000000000\",\"decimals\":6,\"uiAmount\":10000000.0,\"uiAmountString\":\"10000000\"}]}}"));
        fixtureClient.Enqueue("getAsset", JsonDocument.Parse("{\"jsonrpc\":\"2.0\",\"result\":{\"interface\":\"FungibleToken\",\"content\":{\"metadata\":{\"name\":\"USD Coin\",\"symbol\":\"USDC\"},\"json_uri\":\"https://example.org/usdc.json\"},\"token_info\":{\"token_standard\":\"Fungible\"}}}"));

        var result = await service.InspectAsync(usdcMint, CancellationToken.None);

        Assert.Null(result.Error);
        Assert.NotNull(result.Inspection);
        Assert.Equal(usdcMint, result.Inspection.Identity.Mint);
        Assert.Equal("USD Coin", result.Inspection.Identity.Name);
        Assert.Equal("USDC", result.Inspection.Identity.Symbol);
        Assert.Equal(6, result.Inspection.Identity.Decimals);
        Assert.Equal("spl-token", result.Inspection.Program.ProgramType);
    }

    [Fact]
    public async Task InspectAsync_WhenJsonRpcProviderErrorInLargestAccounts_ReturnsProviderRejectedRequest()
    {
        var fixtureClient = new FixtureHeliusClient();
        var service = new TokenInspectionService(fixtureClient);
        const string mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

        var mintData = CreateMintData(
            supply: 100_000UL,
            decimals: 6,
            hasMintAuthority: false,
            hasFreezeAuthority: false);

        fixtureClient.Enqueue("getAccountInfo", JsonDocument.Parse($"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}"));
        // Simulate HeliusClient behavior for JSON-RPC errors in HTTP 200 by throwing typed exception.
        var throwingClient = new ThrowingAfterAccountInfoClient(fixtureClient);
        service = new TokenInspectionService(throwingClient);

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Error);
        Assert.Equal(TokenInspectionErrorCode.ProviderRejectedRequest, result.Error.Code);
    }

    private static byte[] CreateMintData(ulong supply, byte decimals, bool hasMintAuthority, bool hasFreezeAuthority)
    {
        var data = new byte[SolanaTokenConstants.MintAccountBaseLengthBytes];

        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(0, 4), hasMintAuthority ? 1U : 0U);
        if (hasMintAuthority)
        {
            Enumerable.Repeat((byte)9, 32).ToArray().CopyTo(data, 4);
        }

        BinaryPrimitives.WriteUInt64LittleEndian(data.AsSpan(36, 8), supply);
        data[44] = decimals;
        data[45] = 1;

        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(46, 4), hasFreezeAuthority ? 1U : 0U);
        if (hasFreezeAuthority)
        {
            Enumerable.Repeat((byte)2, 32).ToArray().CopyTo(data, 50);
        }

        return data;
    }

    private sealed class ThrowingAfterAccountInfoClient : IHeliusClient
    {
        private readonly FixtureHeliusClient _inner;
        private bool _thrown;

        public ThrowingAfterAccountInfoClient(FixtureHeliusClient inner)
        {
            _inner = inner;
        }

        public HttpRequestMessage CreateRpcPostRequest(string jsonRpcPayload)
        {
            return _inner.CreateRpcPostRequest(jsonRpcPayload);
        }

        public Task<JsonDocument> SendRpcRequestAsync(string method, IReadOnlyList<object?> parameters, CancellationToken cancellationToken)
        {
            if (!_thrown && string.Equals(method, "getTokenLargestAccounts", StringComparison.Ordinal))
            {
                _thrown = true;
                throw new HeliusRpcException(
                    HeliusRpcFailureKind.ProviderError,
                    "Helius RPC returned a JSON-RPC error response.",
                    providerErrorCode: -32010,
                    providerErrorMessage: "method rejected request");
            }

            return _inner.SendRpcRequestAsync(method, parameters, cancellationToken);
        }
    }
}
