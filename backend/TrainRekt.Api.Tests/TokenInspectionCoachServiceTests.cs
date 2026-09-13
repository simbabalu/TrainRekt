using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenInspectionCoachServiceTests
{
    [Fact]
    public async Task GenerateAsync_InspectionFailure_DoesNotCallCoach()
    {
        var inspection = new StubInspectionService(TokenInspectionResult.Failure(TokenInspectionErrorCode.InvalidMint, "bad"));
        var provenance = new StubProvenanceService();
        var coach = new StubCoach();
        var service = CreateService(inspection, provenance, coach, new StubCoachSnapshotRepository());

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
            2,
            DateTimeOffset.UtcNow);
        var snapshotRepository = new StubCoachSnapshotRepository
        {
            FreshSnapshot = new CachedTokenInspectionCoachSnapshot(
                Id: "1",
                Mint: inspection.Identity.Mint,
                Language: "en",
                CoachVersion: 2,
                InputFingerprint: "cached",
                CachedAtUtc: DateTimeOffset.UtcNow,
                ExpiresAtUtc: DateTimeOffset.UtcNow.AddHours(1),
                Coach: cachedPayload)
        };

        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubProvenanceService(), new StubCoach(), snapshotRepository);

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
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubProvenanceService(), coach, repo);

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
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubProvenanceService(), coach, repo);

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
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubProvenanceService(), coach, repo);

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
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubProvenanceService(), coach, repo);

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
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubProvenanceService(), coach, new StubCoachSnapshotRepository());

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

        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubProvenanceService(), coach, new StubCoachSnapshotRepository());

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Same(protocolContext, inspection.ProtocolContext);
        Assert.Equal("ResearchMint1111111111111111111111111111111", inspection.Identity.Mint);
    }

    [Fact]
    public async Task GenerateAsync_ProvenanceUnavailable_StillCallsCoachWithBaseContext()
    {
        var inspection = ResearchTestData.CreateInspection();
        var provenance = new StubProvenanceService { ThrowUnexpected = true };
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };

        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), provenance, coach, new StubCoachSnapshotRepository());

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Equal(1, coach.CallCount);
        Assert.NotNull(coach.LastInput);
        Assert.Null(coach.LastInput!.Identity);
    }

    [Fact]
    public async Task GenerateAsync_CallsProvenanceFromCompletedInspection()
    {
        var inspection = ResearchTestData.CreateInspection();
        var provenance = new StubProvenanceService
        {
            NextResult = new TokenIdentityProvenanceResult(null, CreateProvenance(TokenIdentityClassificationType.CollisionDetected))
        };
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };

        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), provenance, coach, new StubCoachSnapshotRepository());

        _ = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Equal(1, provenance.AnalyzeFromInspectionCallCount);
        Assert.Equal(0, provenance.AnalyzeByMintCallCount);
    }

    [Fact]
    public async Task GenerateAsync_IdentityClassificationChanges_FingerprintChanges()
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

        var repoA = new StubCoachSnapshotRepository();
        var repoB = new StubCoachSnapshotRepository();

        var serviceA = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService
            {
                NextResult = new TokenIdentityProvenanceResult(null, CreateProvenance(TokenIdentityClassificationType.CollisionDetected))
            },
            coach,
            repoA);

        var serviceB = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService
            {
                NextResult = new TokenIdentityProvenanceResult(null, CreateProvenance(TokenIdentityClassificationType.PossibleCopycat))
            },
            coach,
            repoB);

        _ = await serviceA.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);
        _ = await serviceB.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotEqual(repoA.LastReadFingerprint, repoB.LastReadFingerprint);
    }

    private static TokenInspectionCoachService CreateService(
        ITokenInspectionService inspection,
        ITokenIdentityProvenanceService provenance,
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
            provenance,
            coach,
            snapshots,
            factory,
            validator,
            Options.Create(options),
            new FixedTimeProvider(DateTimeOffset.UtcNow),
            NullLogger<TokenInspectionCoachService>.Instance);
    }

    private static TokenIdentityProvenance CreateProvenance(TokenIdentityClassificationType classification)
    {
        return new TokenIdentityProvenance(
            Result: TokenIdentityProvenanceResultType.CollisionObserved,
            Confidence: TokenIdentityProvenanceConfidence.Medium,
            ScannedIdentity: new TokenIdentityProvenanceScannedIdentity("MintA", "Name", "name", "SYM", "sym", DateTimeOffset.UtcNow),
            EarliestObservedMatch: null,
            Collisions: new[]
            {
                new TokenIdentityCollision("MintB", "Name", "SYM", new[] { TokenIdentityMatchDimension.Name }, TokenIdentityMatchLevel.Exact, DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow)
            },
            TotalCollisionCount: 1,
            ReturnedCollisionCount: 1,
            IsTruncated: false,
            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            ConflictingEvidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Unknowns: Array.Empty<TokenIdentityProvenanceUnknown>(),
            AnalyzedAtUtc: DateTimeOffset.UtcNow,
            OnChainChronology: null,
            TrustedIdentityProvenance: new TrustedIdentityProvenance(
                Sources: Array.Empty<IdentitySourceEvidence>(),
                Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CompetingMintChronologies: null,
            IdentityClassification: new TokenIdentityClassification(
                classification,
                TokenIdentityClassificationConfidence.Medium,
                "MintB",
                new[] { TokenIdentityClassificationEvidence.CompetingMintObserved },
                new[]
                {
                    TokenIdentityClassificationLimitation.CopyingIntentNotProven,
                    TokenIdentityClassificationLimitation.GlobalFirstTokenNotProven,
                    TokenIdentityClassificationLimitation.SocialContextNotAnalyzed
                }));
    }

    private sealed class StubProvenanceService : ITokenIdentityProvenanceService
    {
        public TokenIdentityProvenanceResult NextResult { get; set; } = new(null, null);

        public bool ThrowUnexpected { get; set; }

        public int AnalyzeFromInspectionCallCount { get; private set; }

        public int AnalyzeByMintCallCount { get; private set; }

        public Task<TokenIdentityProvenanceResult> AnalyzeAsync(string mint, CancellationToken cancellationToken)
        {
            AnalyzeByMintCallCount += 1;
            return Task.FromResult(NextResult);
        }

        public Task<TokenIdentityProvenanceResult> AnalyzeFromInspectionAsync(TokenInspection inspection, CancellationToken cancellationToken)
        {
            AnalyzeFromInspectionCallCount += 1;

            if (ThrowUnexpected)
            {
                throw new InvalidOperationException("provenance failed");
            }

            return Task.FromResult(NextResult);
        }
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

        public AiSafetyCoachInput? LastInput { get; private set; }

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
            LastInput = input;
            return Task.FromResult(NextResult);
        }
    }

    private sealed class StubCoachSnapshotRepository : IAiSafetyCoachSnapshotRepository
    {
        public CachedTokenInspectionCoachSnapshot? FreshSnapshot { get; set; }

        public bool ThrowOnRead { get; set; }

        public bool ThrowOnWrite { get; set; }

        public List<CachedTokenInspectionCoachSnapshot> Inserts { get; } = new();

        public string LastReadFingerprint { get; private set; } = string.Empty;

        public Task<CachedTokenInspectionCoachSnapshot?> GetFreshAsync(
            string mint,
            string language,
            int coachVersion,
            string inputFingerprint,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken)
        {
            LastReadFingerprint = inputFingerprint;

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