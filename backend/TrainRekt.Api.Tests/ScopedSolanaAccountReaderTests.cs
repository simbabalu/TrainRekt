using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Infrastructure.Helius;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Tests;

public sealed class ScopedSolanaAccountReaderTests
{
    private sealed class FakeHeliusClient : IHeliusClient
    {
        private readonly Func<string, CancellationToken, Task<JsonDocument>> _handler;

        public int CallCount { get; private set; }

        public Dictionary<string, int> CallsByAddress { get; } = new(StringComparer.Ordinal);

        public FakeHeliusClient(Func<string, CancellationToken, Task<JsonDocument>> handler)
        {
            _handler = handler;
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

            Assert.Equal("getAccountInfo", method);
            Assert.NotEmpty(parameters);

            var address = Assert.IsType<string>(parameters[0]);

            CallCount += 1;
            CallsByAddress[address] = CallsByAddress.TryGetValue(address, out var count) ? count + 1 : 1;

            return _handler(address, cancellationToken);
        }
    }

    private sealed class ReaderConsumerA
    {
        private readonly ISolanaAccountReader _reader;

        public ReaderConsumerA(ISolanaAccountReader reader)
        {
            _reader = reader;
        }

        public Task<SolanaAccountInfo?> ReadAsync(string address, CancellationToken cancellationToken)
        {
            return _reader.GetAccountInfoAsync(address, cancellationToken);
        }
    }

    private sealed class ReaderConsumerB
    {
        private readonly ISolanaAccountReader _reader;

        public ReaderConsumerB(ISolanaAccountReader reader)
        {
            _reader = reader;
        }

        public Task<SolanaAccountInfo?> ReadAsync(string address, CancellationToken cancellationToken)
        {
            return _reader.GetAccountInfoAsync(address, cancellationToken);
        }
    }

    [Fact]
    public async Task GetAccountInfoAsync_SameAddressSequential_DeduplicatesRpcCall()
    {
        var payload = BuildAccountInfoResponse(SolanaTokenConstants.SplTokenProgramId, new byte[] { 1, 2, 3 });
        var fakeClient = new FakeHeliusClient((_, _) => Task.FromResult(JsonDocument.Parse(payload)));
        var reader = new ScopedSolanaAccountReader(fakeClient);

        var first = await reader.GetAccountInfoAsync("addr-a", CancellationToken.None);
        var second = await reader.GetAccountInfoAsync("addr-a", CancellationToken.None);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(SolanaTokenConstants.SplTokenProgramId, first.OwnerProgramId);
        Assert.Equal(new byte[] { 1, 2, 3 }, first.Data);
        Assert.Equal(1, fakeClient.CallCount);
        Assert.Equal(1, fakeClient.CallsByAddress["addr-a"]);
    }

    [Fact]
    public async Task GetAccountInfoAsync_SameAddressConcurrent_DeduplicatesInFlightRpcCall()
    {
        var started = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        var payload = BuildAccountInfoResponse(SolanaTokenConstants.SplTokenProgramId, new byte[] { 4, 5, 6 });
        var fakeClient = new FakeHeliusClient(async (_, _) =>
        {
            started.TrySetResult(true);
            await release.Task;
            return JsonDocument.Parse(payload);
        });

        var reader = new ScopedSolanaAccountReader(fakeClient);

        var firstTask = reader.GetAccountInfoAsync("addr-concurrent", CancellationToken.None);
        await started.Task;
        var secondTask = reader.GetAccountInfoAsync("addr-concurrent", CancellationToken.None);

        release.TrySetResult(true);
        await Task.WhenAll(firstTask, secondTask);

        Assert.Equal(1, fakeClient.CallCount);
        Assert.Equal(1, fakeClient.CallsByAddress["addr-concurrent"]);
    }

    [Fact]
    public async Task GetAccountInfoAsync_DifferentAddresses_CallsRpcOncePerAddress()
    {
        var fakeClient = new FakeHeliusClient((address, _) =>
        {
            var payload = BuildAccountInfoResponse(SolanaTokenConstants.SplTokenProgramId, new[] { (byte)address.Length });
            return Task.FromResult(JsonDocument.Parse(payload));
        });

        var reader = new ScopedSolanaAccountReader(fakeClient);

        await reader.GetAccountInfoAsync("addr-1", CancellationToken.None);
        await reader.GetAccountInfoAsync("addr-2", CancellationToken.None);

        Assert.Equal(2, fakeClient.CallCount);
        Assert.Equal(1, fakeClient.CallsByAddress["addr-1"]);
        Assert.Equal(1, fakeClient.CallsByAddress["addr-2"]);
    }

    [Fact]
    public async Task GetAccountInfoAsync_NullValueAccount_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient((_, _) => Task.FromResult(JsonDocument.Parse("{\"jsonrpc\":\"2.0\",\"result\":{\"value\":null}}")));
        var reader = new ScopedSolanaAccountReader(fakeClient);

        var result = await reader.GetAccountInfoAsync("addr-null", CancellationToken.None);

        Assert.Null(result);
        Assert.Equal(1, fakeClient.CallCount);
    }

    [Fact]
    public async Task GetAccountInfoAsync_MalformedAccountResponse_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient((_, _) => Task.FromResult(JsonDocument.Parse("{\"jsonrpc\":\"2.0\",\"result\":{\"value\":{\"owner\":\"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA\"}}}")));
        var reader = new ScopedSolanaAccountReader(fakeClient);

        var result = await reader.GetAccountInfoAsync("addr-malformed", CancellationToken.None);

        Assert.Null(result);
        Assert.Equal(1, fakeClient.CallCount);
    }

    [Fact]
    public async Task GetAccountInfoAsync_HeliusProviderFailure_Propagates()
    {
        var fakeClient = new FakeHeliusClient((_, _) => throw new HeliusRpcException(HeliusRpcFailureKind.ProviderError, "provider error"));
        var reader = new ScopedSolanaAccountReader(fakeClient);

        await Assert.ThrowsAsync<HeliusRpcException>(() => reader.GetAccountInfoAsync("addr-provider-fail", CancellationToken.None));
    }

    [Fact]
    public async Task GetAccountInfoAsync_CancellationPropagatesAndDoesNotPoisonCache()
    {
        var release = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var fakeClient = new FakeHeliusClient(async (_, _) =>
        {
            await release.Task;
            return JsonDocument.Parse(BuildAccountInfoResponse(SolanaTokenConstants.SplTokenProgramId, new byte[] { 9 }));
        });

        var reader = new ScopedSolanaAccountReader(fakeClient);

        using var cts = new CancellationTokenSource();
        var canceledTask = reader.GetAccountInfoAsync("addr-cancel", cts.Token);
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await canceledTask);

        release.TrySetResult(true);

        var result = await reader.GetAccountInfoAsync("addr-cancel", CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(1, fakeClient.CallCount);
    }

    [Fact]
    public async Task SharedReaderAcrossTwoConsumers_ReusesSingleRpcLookupPerAddress()
    {
        var payload = BuildAccountInfoResponse(SolanaTokenConstants.SplTokenProgramId, new byte[] { 7, 7 });
        var fakeClient = new FakeHeliusClient((_, _) => Task.FromResult(JsonDocument.Parse(payload)));
        var reader = new ScopedSolanaAccountReader(fakeClient);

        var consumerA = new ReaderConsumerA(reader);
        var consumerB = new ReaderConsumerB(reader);

        var first = await consumerA.ReadAsync("addr-shared", CancellationToken.None);
        var second = await consumerB.ReadAsync("addr-shared", CancellationToken.None);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(1, fakeClient.CallCount);
    }

    private static string BuildAccountInfoResponse(string ownerProgramId, byte[] data)
    {
        return "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":{\"owner\":\""
            + ownerProgramId
            + "\",\"data\":[\""
            + Convert.ToBase64String(data)
            + "\",\"base64\"]}}}";
    }
}
