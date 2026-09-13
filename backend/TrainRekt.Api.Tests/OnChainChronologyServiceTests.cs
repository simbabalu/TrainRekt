using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class OnChainChronologyServiceTests
{
    [Fact]
    public async Task AnalyzeAsync_OneSignatureWithBlockTime_ReturnsBlockTimePrecision()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult("{" + "\"result\":[{\"signature\":\"sig-1\",\"slot\":100,\"blockTime\":1700000000}]}" );

        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal("sig-1", result.EarliestObservedSignature);
        Assert.Equal(100, result.EarliestObservedSlot);
        Assert.Equal(OnChainChronologyPrecision.BlockTime, result.Precision);
        Assert.Equal(OnChainChronologyCoverage.CompleteWithinProviderResult, result.HistoryCoverage);
        Assert.True(result.PaginationExhausted);
    }

    [Fact]
    public async Task AnalyzeAsync_OneSignatureWithoutBlockTime_UsesSlotOnlyAndUnknown()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult("{" + "\"result\":[{\"signature\":\"sig-1\",\"slot\":100,\"blockTime\":null}]}" );

        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(OnChainChronologyPrecision.SlotOnly, result.Precision);
        Assert.Contains(OnChainChronologyUnknown.BlockTimeUnavailable, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_DeterministicMinimumSlotSelected()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult("{" + "\"result\":[{" +
            "\"signature\":\"sig-9\",\"slot\":109,\"blockTime\":1700000010},{" +
            "\"signature\":\"sig-1\",\"slot\":101,\"blockTime\":1700000001},{" +
            "\"signature\":\"sig-5\",\"slot\":105,\"blockTime\":1700000005}]}" );

        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal("sig-1", result.EarliestObservedSignature);
        Assert.Equal(101, result.EarliestObservedSlot);
    }

    [Fact]
    public async Task AnalyzeAsync_TieBreaksBySignatureDeterministically()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult("{" + "\"result\":[{" +
            "\"signature\":\"sig-b\",\"slot\":100,\"blockTime\":1700000002},{" +
            "\"signature\":\"sig-a\",\"slot\":100,\"blockTime\":1700000003}]}" );

        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal("sig-a", result.EarliestObservedSignature);
    }

    [Fact]
    public async Task AnalyzeAsync_MultiplePages_UsesBeforeCursorFromOldestRow()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult("{" + "\"result\":[{" +
            "\"signature\":\"sig-new\",\"slot\":120,\"blockTime\":1700000020},{" +
            "\"signature\":\"sig-old\",\"slot\":110,\"blockTime\":1700000010}]}" );
        helius.EnqueueResult("{" + "\"result\":[{\"signature\":\"sig-older\",\"slot\":100,\"blockTime\":1700000000}]}" );

        var service = CreateService(
            helius,
            new StubChronologySnapshotRepository(),
            new OnChainChronologyOptions { PageSize = 2, MaxPages = 8, MaxSignatures = 8000, TimeoutSeconds = 10, CompleteFreshnessHours = 168, PartialFreshnessMinutes = 60, FailureFreshnessMinutes = 10 });

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(2, helius.CallCount);
        Assert.Equal("sig-old", helius.BeforeValues[1]);
        Assert.Equal("sig-older", result.EarliestObservedSignature);
        Assert.Equal(2, result.PagesScanned);
        Assert.Equal(3, result.SignaturesScanned);
    }

    [Fact]
    public async Task AnalyzeAsync_EmptyPage_ExhaustsPagination()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult("{" + "\"result\":[]}" );

        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(OnChainChronologyCoverage.Unavailable, result.HistoryCoverage);
        Assert.True(result.PaginationExhausted);
        Assert.Equal(1, result.PagesScanned);
    }

    [Fact]
    public async Task AnalyzeAsync_PageLimitReached_ReturnsPartialPageLimit()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult(PageWith("sig-3", 103, "sig-2", 102));
        helius.EnqueueResult(PageWith("sig-1", 101, "sig-0", 100));

        var service = CreateService(
            helius,
            new StubChronologySnapshotRepository(),
            new OnChainChronologyOptions { PageSize = 2, MaxPages = 1, MaxSignatures = 8000, TimeoutSeconds = 10, CompleteFreshnessHours = 168, PartialFreshnessMinutes = 60, FailureFreshnessMinutes = 10 });

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(OnChainChronologyCoverage.PartialPageLimit, result.HistoryCoverage);
        Assert.False(result.PaginationExhausted);
        Assert.Contains(OnChainChronologyUnknown.ChainHistoryPartial, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_SignatureLimitReached_ReturnsPartialSignatureLimit()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult(PageWith("sig-3", 103, "sig-2", 102));

        var service = CreateService(
            helius,
            new StubChronologySnapshotRepository(),
            new OnChainChronologyOptions { PageSize = 2, MaxPages = 8, MaxSignatures = 1, TimeoutSeconds = 10, CompleteFreshnessHours = 168, PartialFreshnessMinutes = 60, FailureFreshnessMinutes = 10 });

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(OnChainChronologyCoverage.PartialSignatureLimit, result.HistoryCoverage);
        Assert.Equal(1, result.SignaturesScanned);
    }

    [Fact]
    public async Task AnalyzeAsync_DuplicateSignatures_AreDeduplicated()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult(PageWith("sig-2", 102, "sig-1", 101));
        helius.EnqueueResult("{" + "\"result\":[{" +
            "\"signature\":\"sig-1\",\"slot\":101,\"blockTime\":1700000001},{" +
            "\"signature\":\"sig-0\",\"slot\":100,\"blockTime\":1700000000}]}" );

        var service = CreateService(
            helius,
            new StubChronologySnapshotRepository(),
            new OnChainChronologyOptions { PageSize = 2, MaxPages = 8, MaxSignatures = 8000, TimeoutSeconds = 10, CompleteFreshnessHours = 168, PartialFreshnessMinutes = 60, FailureFreshnessMinutes = 10 });

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(3, result.SignaturesScanned);
        Assert.Equal("sig-0", result.EarliestObservedSignature);
    }

    [Fact]
    public async Task AnalyzeAsync_MalformedRows_AreIgnoredSafely()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult("{" + "\"result\":[{" +
            "\"slot\":100},{" +
            "\"signature\":\"sig-1\",\"slot\":100,\"blockTime\":1700000000},{" +
            "\"signature\":\"\",\"slot\":50}]}" );

        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal("sig-1", result.EarliestObservedSignature);
        Assert.Equal(1, result.SignaturesScanned);
    }

    [Fact]
    public async Task AnalyzeAsync_ProviderFailureBeforeEvidence_ReturnsUnavailable()
    {
        var helius = new FakeHeliusClient { ThrowOnCall = 1, ThrowException = new InvalidOperationException("provider down") };
        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(OnChainChronologyCoverage.Unavailable, result.HistoryCoverage);
        Assert.Null(result.EarliestObservedSignature);
    }

    [Fact]
    public async Task AnalyzeAsync_ProviderFailureAfterEvidence_ReturnsPartialProviderFailure()
    {
        var helius = new FakeHeliusClient { ThrowOnCall = 2, ThrowException = new InvalidOperationException("provider down") };
        helius.EnqueueResult(PageWith("sig-2", 102, "sig-1", 101));

        var service = CreateService(
            helius,
            new StubChronologySnapshotRepository(),
            new OnChainChronologyOptions { PageSize = 2, MaxPages = 8, MaxSignatures = 8000, TimeoutSeconds = 10, CompleteFreshnessHours = 168, PartialFreshnessMinutes = 60, FailureFreshnessMinutes = 10 });

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(OnChainChronologyCoverage.PartialProviderFailure, result.HistoryCoverage);
        Assert.NotNull(result.EarliestObservedSignature);
    }

    [Fact]
    public async Task AnalyzeAsync_TimeoutBeforeEvidence_ReturnsUnavailable()
    {
        var helius = new FakeHeliusClient { ThrowOnCall = 1, ThrowException = new OperationCanceledException("timeout") };
        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(OnChainChronologyCoverage.Unavailable, result.HistoryCoverage);
    }

    [Fact]
    public async Task AnalyzeAsync_TimeoutAfterEvidence_ReturnsPartialTimeout()
    {
        var helius = new FakeHeliusClient { ThrowOnCall = 2, ThrowException = new OperationCanceledException("timeout") };
        helius.EnqueueResult(PageWith("sig-2", 102, "sig-1", 101));

        var service = CreateService(
            helius,
            new StubChronologySnapshotRepository(),
            new OnChainChronologyOptions { PageSize = 2, MaxPages = 8, MaxSignatures = 8000, TimeoutSeconds = 10, CompleteFreshnessHours = 168, PartialFreshnessMinutes = 60, FailureFreshnessMinutes = 10 });

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(OnChainChronologyCoverage.PartialTimeout, result.HistoryCoverage);
        Assert.NotNull(result.EarliestObservedSignature);
    }

    [Fact]
    public async Task AnalyzeAsync_CallerCancellation_Propagates()
    {
        var helius = new FakeHeliusClient();
        var service = CreateService(helius, new StubChronologySnapshotRepository());
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.AnalyzeAsync("So11111111111111111111111111111111111111112", cts.Token));
    }

    [Fact]
    public async Task AnalyzeAsync_RetainsCanonicalCreationUnknownAndProviderRetentionUnknown()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult(PageWith("sig-1", 101));

        var service = CreateService(helius, new StubChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.False(result.AccountCreationProven);
        Assert.Contains(OnChainChronologyUnknown.CanonicalCreationTimeNotProven, result.Unknowns);
        Assert.Contains(OnChainChronologyUnknown.ProviderRetentionUnknown, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_FreshCompleteCache_SkipsHelius()
    {
        var cached = CreateEvidence(OnChainChronologyCoverage.CompleteWithinProviderResult);
        var cache = new StubChronologySnapshotRepository
        {
            FreshSnapshot = new CachedTokenIdentityChronologySnapshot(
                Id: "1",
                Mint: "So11111111111111111111111111111111111111112",
                ChronologyVersion: 1,
                AnalyzedAtUtc: cached.AnalyzedAtUtc,
                CachedAtUtc: cached.AnalyzedAtUtc,
                ExpiresAtUtc: cached.AnalyzedAtUtc.AddHours(1),
                Evidence: cached)
        };
        var helius = new FakeHeliusClient();
        var service = CreateService(helius, cache);

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(0, helius.CallCount);
        Assert.Equal(OnChainChronologyCoverage.CompleteWithinProviderResult, result.HistoryCoverage);
    }

    [Fact]
    public async Task AnalyzeAsync_FreshPartialCache_SkipsHelius()
    {
        var cached = CreateEvidence(OnChainChronologyCoverage.PartialPageLimit);
        var cache = new StubChronologySnapshotRepository
        {
            FreshSnapshot = new CachedTokenIdentityChronologySnapshot(
                Id: "1",
                Mint: "So11111111111111111111111111111111111111112",
                ChronologyVersion: 1,
                AnalyzedAtUtc: cached.AnalyzedAtUtc,
                CachedAtUtc: cached.AnalyzedAtUtc,
                ExpiresAtUtc: cached.AnalyzedAtUtc.AddHours(1),
                Evidence: cached)
        };
        var helius = new FakeHeliusClient();
        var service = CreateService(helius, cache);

        var _ = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(0, helius.CallCount);
    }

    [Fact]
    public async Task AnalyzeAsync_ExpiredOrVersionMismatchCache_InvokesHelius()
    {
        var cache = new StubChronologySnapshotRepository();
        var helius = new FakeHeliusClient();
        helius.EnqueueResult(PageWith("sig-1", 101));
        var service = CreateService(helius, cache);

        var _ = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(1, helius.CallCount);
        Assert.Single(cache.Inserts);
    }

    [Fact]
    public async Task AnalyzeAsync_RequestsCurrentChronologyVersionFromCache()
    {
        var cache = new StubChronologySnapshotRepository();
        var helius = new FakeHeliusClient();
        helius.EnqueueResult(PageWith("sig-1", 101));
        var service = CreateService(helius, cache);

        _ = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(1, cache.LastRequestedChronologyVersion);
    }

    [Fact]
    public async Task AnalyzeAsync_CacheReadFailure_PreventsUncontrolledProviderFallback()
    {
        var cache = new StubChronologySnapshotRepository { ThrowOnRead = true };
        var helius = new FakeHeliusClient();
        var service = CreateService(helius, cache);

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal(0, helius.CallCount);
        Assert.Equal(OnChainChronologyCoverage.Unavailable, result.HistoryCoverage);
    }

    [Fact]
    public async Task AnalyzeAsync_CacheWriteFailure_StillReturnsCurrentEvidence()
    {
        var cache = new StubChronologySnapshotRepository { ThrowOnWrite = true };
        var helius = new FakeHeliusClient();
        helius.EnqueueResult(PageWith("sig-1", 101));
        var service = CreateService(helius, cache);

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal("sig-1", result.EarliestObservedSignature);
    }

    [Fact]
    public async Task AnalyzeAsync_NoOpCache_AllowsUncachedChronology()
    {
        var helius = new FakeHeliusClient();
        helius.EnqueueResult(PageWith("sig-1", 101));
        var service = CreateService(helius, new NoOpTokenIdentityChronologySnapshotRepository());

        var result = await service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None);

        Assert.Equal("sig-1", result.EarliestObservedSignature);
        Assert.Equal(1, helius.CallCount);
    }

    [Fact]
    public async Task AnalyzeAsync_CachePathCancellation_Propagates()
    {
        var cache = new StubChronologySnapshotRepository { ThrowCancellation = true };
        var service = CreateService(new FakeHeliusClient(), cache);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.AnalyzeAsync("So11111111111111111111111111111111111111112", CancellationToken.None));
    }

    private static OnChainChronologyService CreateService(
        IHeliusClient helius,
        ITokenIdentityChronologySnapshotRepository repository,
        OnChainChronologyOptions? options = null)
    {
        options ??= new OnChainChronologyOptions
        {
            PageSize = 1000,
            MaxPages = 8,
            MaxSignatures = 8000,
            TimeoutSeconds = 10,
            CompleteFreshnessHours = 168,
            PartialFreshnessMinutes = 60,
            FailureFreshnessMinutes = 10
        };

        return new OnChainChronologyService(
            helius,
            repository,
            Options.Create(options),
            new FixedTimeProvider(new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero)),
            NullLogger<OnChainChronologyService>.Instance);
    }

    private static string PageWith(string signatureA, long slotA)
    {
        return "{" + $"\"result\":[{{\"signature\":\"{signatureA}\",\"slot\":{slotA},\"blockTime\":1700000000}}]" + "}";
    }

    private static string PageWith(string signatureA, long slotA, string signatureB, long slotB)
    {
        return "{" + $"\"result\":[{{\"signature\":\"{signatureA}\",\"slot\":{slotA},\"blockTime\":1700000001}},{{\"signature\":\"{signatureB}\",\"slot\":{slotB},\"blockTime\":1700000000}}]" + "}";
    }

    private static OnChainChronologyEvidence CreateEvidence(OnChainChronologyCoverage coverage)
    {
        return new OnChainChronologyEvidence(
            EarliestObservedSignature: "cached-sig",
            EarliestObservedSlot: 100,
            EarliestObservedBlockTimeUtc: DateTimeOffset.FromUnixTimeSeconds(1700000000),
            HistoryCoverage: coverage,
            PaginationExhausted: coverage == OnChainChronologyCoverage.CompleteWithinProviderResult,
            PagesScanned: 1,
            SignaturesScanned: 1,
            Source: "HELIUS_SOLANA_RPC",
            Confidence: OnChainChronologyConfidence.High,
            Precision: OnChainChronologyPrecision.BlockTime,
            AccountCreationProven: false,
            Unknowns: new[]
            {
                OnChainChronologyUnknown.CanonicalCreationTimeNotProven,
                OnChainChronologyUnknown.ProviderRetentionUnknown
            },
            AnalyzedAtUtc: new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero));
    }

    private sealed class FakeHeliusClient : IHeliusClient
    {
        private readonly Queue<string> _responses = new();

        public int CallCount { get; private set; }

        public int? ThrowOnCall { get; set; }

        public Exception? ThrowException { get; set; }

        public List<string?> BeforeValues { get; } = new();

        public void EnqueueResult(string json)
        {
            _responses.Enqueue(json);
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
            CallCount += 1;

            if (ThrowOnCall.HasValue && ThrowOnCall.Value == CallCount)
            {
                throw ThrowException ?? new InvalidOperationException("forced provider failure");
            }

            if (!string.Equals(method, "getSignaturesForAddress", StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"Unexpected method {method}");
            }

            var before = (string?)null;
            if (parameters.Count > 1 && parameters[1] is IDictionary<string, object?> config && config.TryGetValue("before", out var beforeValue))
            {
                before = beforeValue as string;
            }

            BeforeValues.Add(before);

            if (_responses.Count == 0)
            {
                throw new InvalidOperationException("missing fake response");
            }

            return Task.FromResult(JsonDocument.Parse(_responses.Dequeue()));
        }
    }

    private sealed class StubChronologySnapshotRepository : ITokenIdentityChronologySnapshotRepository
    {
        public CachedTokenIdentityChronologySnapshot? FreshSnapshot { get; set; }

        public bool ThrowOnRead { get; set; }

        public bool ThrowOnWrite { get; set; }

        public bool ThrowCancellation { get; set; }

        public List<CachedTokenIdentityChronologySnapshot> Inserts { get; } = new();

        public int LastRequestedChronologyVersion { get; private set; }

        public Task<CachedTokenIdentityChronologySnapshot?> GetFreshAsync(
            string mint,
            int chronologyVersion,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken)
        {
            LastRequestedChronologyVersion = chronologyVersion;

            if (ThrowCancellation)
            {
                throw new OperationCanceledException("cancelled");
            }

            if (ThrowOnRead)
            {
                throw new InvalidOperationException("cache read failed");
            }

            return Task.FromResult(FreshSnapshot);
        }

        public Task InsertAsync(CachedTokenIdentityChronologySnapshot snapshot, CancellationToken cancellationToken)
        {
            if (ThrowCancellation)
            {
                throw new OperationCanceledException("cancelled");
            }

            if (ThrowOnWrite)
            {
                throw new InvalidOperationException("cache write failed");
            }

            Inserts.Add(snapshot);
            return Task.CompletedTask;
        }
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _now;

        public FixedTimeProvider(DateTimeOffset now)
        {
            _now = now;
        }

        public override DateTimeOffset GetUtcNow() => _now;
    }
}
