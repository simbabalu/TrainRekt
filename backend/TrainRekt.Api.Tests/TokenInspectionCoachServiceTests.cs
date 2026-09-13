using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;

namespace TrainRekt.Api.Tests;

public sealed class TokenInspectionCoachServiceTests
{
    [Fact]
    public async Task GenerateAsync_InspectionFailure_DoesNotCallCoach()
    {
        var inspection = new StubInspectionService(TokenInspectionResult.Failure(TokenInspectionErrorCode.InvalidMint, "bad"));
        var coach = new StubCoach();
        var service = CreateService(inspection, coach, new StubCoachSnapshotRepository());

        var result = await service.GenerateAsync("bad", CancellationToken.None);

        Assert.False(result.Available);
        Assert.NotNull(result.InspectionError);
        Assert.Equal(0, coach.CallCount);
    }

    [Fact]
    public async Task GenerateAsync_CacheHit_DoesNotCallCoach()
    {
        var inspection = ResearchTestData.CreateInspection();
        var cachedPayload = new AiSafetyCoachPayload(
            new AiSafetyCoachContent("sum", new[] { "risk" }, new[] { "check" }, new[] { "uncertain" }, "token-2022"),
            1,
            DateTimeOffset.UtcNow);
        var snapshotRepository = new StubCoachSnapshotRepository
        {
            FreshSnapshot = new CachedTokenInspectionCoachSnapshot(
                Id: "1",
                Mint: inspection.Identity.Mint,
                Language: "en",
                CoachVersion: 1,
                InputFingerprint: "cached",
                CachedAtUtc: DateTimeOffset.UtcNow,
                ExpiresAtUtc: DateTimeOffset.UtcNow.AddHours(1),
                Coach: cachedPayload)
        };

        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubCoach(), snapshotRepository);

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Equal(AiSafetyCoachStatus.Available, result.Status);
        Assert.Equal("sum", result.Coach!.Content.Summary);
    }

    [Fact]
    public async Task GenerateAsync_CacheReadFailure_FailsClosedAndSkipsCoach()
    {
        var inspection = ResearchTestData.CreateInspection();
        var coach = new StubCoach();
        var repo = new StubCoachSnapshotRepository { ThrowOnRead = true };
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), coach, repo);

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.False(result.Available);
        Assert.Equal(AiSafetyCoachStatus.CacheUnavailable, result.Status);
        Assert.Equal(0, coach.CallCount);
    }

    [Fact]
    public async Task GenerateAsync_CacheMiss_CallsCoachAndPersists()
    {
        var inspection = ResearchTestData.CreateInspection();
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, "token-2022"),
                null,
                null)
        };
        var repo = new StubCoachSnapshotRepository();
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), coach, repo);

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Equal(1, coach.CallCount);
        Assert.Single(repo.Inserts);
    }

    [Fact]
    public async Task GenerateAsync_CacheWriteFailure_StillReturnsValidCoach()
    {
        var inspection = ResearchTestData.CreateInspection();
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };
        var repo = new StubCoachSnapshotRepository { ThrowOnWrite = true };
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), coach, repo);

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Equal(AiSafetyCoachStatus.Available, result.Status);
    }

    [Fact]
    public async Task GenerateAsync_InvalidModelOutput_FailsClosedAndDoesNotPersist()
    {
        var inspection = ResearchTestData.CreateInspection();
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("this is safe", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };
        var repo = new StubCoachSnapshotRepository();
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), coach, repo);

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.False(result.Available);
        Assert.Equal(AiSafetyCoachStatus.InvalidResponse, result.Status);
        Assert.Empty(repo.Inserts);
    }

    [Fact]
    public async Task GenerateAsync_CancellationFromCoach_Propagates()
    {
        var inspection = ResearchTestData.CreateInspection();
        var coach = new StubCoach { ThrowCancellation = true };
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), coach, new StubCoachSnapshotRepository());

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None));
    }

    [Fact]
    public async Task GenerateAsync_DoesNotMutateInspectionFactsOrProtocolContext()
    {
        var protocolContext = new Domain.Models.ProtocolResearchContext(
            "protocol",
            Array.Empty<Domain.Models.ResearchSource>(),
            Array.Empty<Domain.Models.DocumentedClaim>());

        var inspection = ResearchTestData.CreateInspection(protocolContext: protocolContext);
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };

        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), coach, new StubCoachSnapshotRepository());

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Same(protocolContext, inspection.ProtocolContext);
        Assert.Equal("ResearchMint1111111111111111111111111111111", inspection.Identity.Mint);
    }

    private static TokenInspectionCoachService CreateService(
        ITokenInspectionService inspection,
        IAiSafetyCoach coach,
        IAiSafetyCoachSnapshotRepository snapshots,
        AiSafetyCoachOptions? options = null)
    {
        options ??= new AiSafetyCoachOptions
        {
            Enabled = true,
            Language = "en"
        };

        var factory = new AiSafetyCoachInputFactory(Options.Create(options));
        var validator = new AiSafetyCoachResponseValidator(Options.Create(options));

        return new TokenInspectionCoachService(
            inspection,
            coach,
            snapshots,
            factory,
            validator,
            Options.Create(options),
            new FixedTimeProvider(DateTimeOffset.UtcNow),
            NullLogger<TokenInspectionCoachService>.Instance);
    }

    private sealed class StubInspectionService : ITokenInspectionService
    {
        private readonly TokenInspectionResult _result;

        public StubInspectionService(TokenInspectionResult result)
        {
            _result = result;
        }

        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult(_result);
        }
    }

    private sealed class StubCoach : IAiSafetyCoach
    {
        public int CallCount { get; private set; }

        public bool ThrowCancellation { get; set; }

        public AiSafetyCoachModelResult NextResult { get; set; } = new(
            false,
            null,
            AiSafetyCoachFailureReason.Disabled,
            "disabled");

        public Task<AiSafetyCoachModelResult> GenerateAsync(AiSafetyCoachInput input, CancellationToken cancellationToken)
        {
            if (ThrowCancellation)
            {
                throw new OperationCanceledException("cancelled");
            }

            CallCount += 1;
            return Task.FromResult(NextResult);
        }
    }

    private sealed class StubCoachSnapshotRepository : IAiSafetyCoachSnapshotRepository
    {
        public CachedTokenInspectionCoachSnapshot? FreshSnapshot { get; set; }

        public bool ThrowOnRead { get; set; }

        public bool ThrowOnWrite { get; set; }

        public List<CachedTokenInspectionCoachSnapshot> Inserts { get; } = new();

        public Task<CachedTokenInspectionCoachSnapshot?> GetFreshAsync(
            string mint,
            string language,
            int coachVersion,
            string inputFingerprint,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken)
        {
            if (ThrowOnRead)
            {
                throw new InvalidOperationException("cache read failure");
            }

            if (FreshSnapshot is not null)
            {
                return Task.FromResult<CachedTokenInspectionCoachSnapshot?>(FreshSnapshot);
            }

            return Task.FromResult<CachedTokenInspectionCoachSnapshot?>(null);
        }

        public Task InsertAsync(CachedTokenInspectionCoachSnapshot snapshot, CancellationToken cancellationToken)
        {
            if (ThrowOnWrite)
            {
                throw new InvalidOperationException("cache write failure");
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