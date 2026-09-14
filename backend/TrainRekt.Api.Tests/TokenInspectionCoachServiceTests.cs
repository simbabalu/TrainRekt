using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
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
            AiSafetyCoachVersion.Current,
            DateTimeOffset.UtcNow);
        var snapshotRepository = new StubCoachSnapshotRepository
        {
            FreshSnapshot = new CachedTokenInspectionCoachSnapshot(
                Id: "1",
                Mint: inspection.Identity.Mint,
                Language: "en",
                CoachVersion: AiSafetyCoachVersion.Current,
                InputFingerprint: string.Empty,
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
    public async Task GenerateAsync_SameMintSameInputSameVersion_UsesCacheHit()
    {
        var inspection = ResearchTestData.CreateInspection();
        var now = DateTimeOffset.UtcNow;
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("first", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };
        var repo = new StubCoachSnapshotRepository();
        var service = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService(),
            coach,
            repo,
            timeProvider: new FixedTimeProvider(now));

        var first = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);
        Assert.True(first.Available);
        Assert.Equal(1, coach.CallCount);

        coach.NextResult = new AiSafetyCoachModelResult(
            true,
            new AiSafetyCoachContent("second", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
            null,
            null);

        var second = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(second.Available);
        Assert.Equal(1, coach.CallCount);
        Assert.Equal("first", second.Coach!.Content.Summary);
    }

    [Fact]
    public async Task GenerateAsync_SameMintSameInputNewerVersion_DoesNotReuseOlderSnapshot_AndPersistsCurrentVersion()
    {
        var inspection = ResearchTestData.CreateInspection();
        var now = DateTimeOffset.UtcNow;
        var oldSnapshot = new CachedTokenInspectionCoachSnapshot(
            Id: "old",
            Mint: inspection.Identity.Mint,
            Language: "en",
            CoachVersion: AiSafetyCoachVersion.Current - 1,
            InputFingerprint: string.Empty,
            CachedAtUtc: now,
            ExpiresAtUtc: now.AddHours(2),
            Coach: new AiSafetyCoachPayload(
                new AiSafetyCoachContent("old-summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                AiSafetyCoachVersion.Current - 1,
                now));

        var repo = new StubCoachSnapshotRepository
        {
            FreshSnapshot = oldSnapshot
        };

        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("new-summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };

        var service = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService(),
            coach,
            repo,
            timeProvider: new FixedTimeProvider(now));

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Equal(1, coach.CallCount);
        Assert.Equal("new-summary", result.Coach!.Content.Summary);
        Assert.Contains(repo.Inserts, item => item.CoachVersion == AiSafetyCoachVersion.Current);
    }

    [Fact]
    public async Task GenerateAsync_PersistedSnapshotExpiry_UsesFreshnessHoursTtl()
    {
        var inspection = ResearchTestData.CreateInspection();
        var now = DateTimeOffset.UtcNow;
        var options = new AiSafetyCoachOptions
        {
            Enabled = true,
            Language = "en",
            FreshnessHours = 24
        };

        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };

        var repo = new StubCoachSnapshotRepository();
        var service = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService(),
            coach,
            repo,
            options: options,
            timeProvider: new FixedTimeProvider(now));

        _ = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        var inserted = Assert.Single(repo.Inserts);
        Assert.Equal(now.AddHours(options.FreshnessHours), inserted.ExpiresAtUtc);
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
    public async Task GenerateAsync_Http200CoachWithOverlengthSummary_ReturnsInvalidResponse()
    {
        var inspection = ResearchTestData.CreateInspection();
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent(new string('s', 181), new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };

        var service = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService(),
            coach,
            new StubCoachSnapshotRepository(),
            options: new AiSafetyCoachOptions
            {
                Enabled = true,
                Language = "en",
                MaxSummaryLength = 180,
                MaxSummarySentences = 2,
                MaxRiskExplanations = 3,
                MaxWhatToCheckNext = 2,
                MaxUncertaintyItems = 2,
                MaxListItemLength = 90
            });

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.False(result.Available);
        Assert.Equal(AiSafetyCoachStatus.InvalidResponse, result.Status);
    }

    [Fact]
    public async Task GenerateAsync_Http200CoachWithLongTwoSentenceSummary_SucceedsWithUpdatedBudget()
    {
        var inspection = ResearchTestData.CreateInspection();
        var summary = $"{new string('a', 150)}. {new string('b', 149)}.";
        Assert.True(summary.Length > 240);
        Assert.True(summary.Length <= 320);
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent(summary, new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };

        var service = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService(),
            coach,
            new StubCoachSnapshotRepository(),
            options: new AiSafetyCoachOptions
            {
                Enabled = true,
                Language = "en",
                MaxSummaryLength = 320,
                MaxSummarySentences = 2,
                MaxRiskExplanations = 3,
                MaxWhatToCheckNext = 2,
                MaxUncertaintyItems = 2,
                MaxListItemLength = 90
            });

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Equal(AiSafetyCoachStatus.Available, result.Status);
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
    public async Task GenerateAsync_CallerCancellationToken_PropagatesAndIsNotConverted()
    {
        var inspection = ResearchTestData.CreateInspection();
        var coach = new StubCoach { RespectCallerCancellation = true };
        var service = CreateService(new StubInspectionService(TokenInspectionResult.Success(inspection)), new StubProvenanceService(), coach, new StubCoachSnapshotRepository());
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.GenerateAsync(inspection.Identity.Mint, cts.Token));
    }

    [Fact]
    public async Task GenerateAsync_CallerCancellationDuringExternalContext_Propagates()
    {
        var inspection = ResearchTestData.CreateInspection();
        var externalContext = new StubExternalContextResearchService { RespectCallerCancellation = true };
        var service = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService(),
            new StubCoach(),
            new StubCoachSnapshotRepository(),
            externalContext);

        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.GenerateAsync(inspection.Identity.Mint, cts.Token));
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
    public async Task GenerateAsync_ExternalContextUnavailable_StillCallsCoachWithDeterministicInput()
    {
        var inspection = ResearchTestData.CreateInspection();
        var externalContext = new StubExternalContextResearchService
        {
            Next = new TokenExternalContext(
                TokenExternalContextAvailability.Unavailable,
                TokenExternalAssetType.Unknown,
                null,
                null,
                "LOW",
                false,
                false,
                Array.Empty<TokenExternalContextEvidence>(),
                TokenExternalContextFailureReason.Timeout)
        };
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent("summary", new[] { "risk" }, new[] { "check" }, new[] { "uncertainty" }, null),
                null,
                null)
        };

        var service = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService(),
            coach,
            new StubCoachSnapshotRepository(),
            externalContext);

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.Equal(1, coach.CallCount);
        Assert.NotNull(coach.LastInput);
        Assert.NotNull(coach.LastInput!.ExternalContext);
        Assert.Equal("UNAVAILABLE", coach.LastInput.ExternalContext!.Availability);
    }

    [Fact]
    public async Task GenerateAsync_ExternalContextPassedToCoach_AsLowerTrustContext()
    {
        var inspection = ResearchTestData.CreateInspection();
        var externalContext = new StubExternalContextResearchService
        {
            Next = new TokenExternalContext(
                TokenExternalContextAvailability.Available,
                TokenExternalAssetType.TokenizedStock,
                "Issuer X",
                "External sources identify a tokenized equity framework with issuer controls.",
                "MEDIUM",
                true,
                false,
                new[]
                {
                    new TokenExternalContextEvidence(
                        TokenExternalContextSourceType.OfficialIssuerDocumentation,
                        "Issuer docs",
                        "issuer.example",
                        "Mint appears in tokenized equity issuance docs.",
                        "https://issuer.example/docs")
                })
        };
        var coach = new StubCoach
        {
            NextResult = new AiSafetyCoachModelResult(
                true,
                new AiSafetyCoachContent(
                    "External docs can explain controls; active freeze authority still remains an admin-control risk.",
                    new[] { "Issuer documentation can explain why freeze controls exist." },
                    new[] { "Confirm policy docs still reference this exact mint." },
                    new[] { "Issuer legitimacy is not proven by context alone." },
                    null),
                null,
                null)
        };

        var service = CreateService(
            new StubInspectionService(TokenInspectionResult.Success(inspection)),
            new StubProvenanceService(),
            coach,
            new StubCoachSnapshotRepository(),
            externalContext);

        var result = await service.GenerateAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.True(result.Available);
        Assert.NotNull(coach.LastInput?.ExternalContext);
        Assert.Equal("TOKENIZED_STOCK", coach.LastInput!.ExternalContext!.AssetType);
        Assert.True(coach.LastInput.ExternalContext.MintConfirmed);
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
        ITokenExternalContextResearchService? externalContextService = null,
        AiSafetyCoachOptions? options = null,
        TimeProvider? timeProvider = null)
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
            externalContextService ?? new StubExternalContextResearchService(),
            snapshots,
            factory,
            validator,
            Options.Create(options),
            timeProvider ?? new FixedTimeProvider(DateTimeOffset.UtcNow),
            NullLogger<TokenInspectionCoachService>.Instance);
    }

    private sealed class StubExternalContextResearchService : ITokenExternalContextResearchService
    {
        public TokenExternalContext Next { get; set; } = new(
            TokenExternalContextAvailability.Unavailable,
            TokenExternalAssetType.Unknown,
            null,
            null,
            "LOW",
            false,
            false,
            Array.Empty<TokenExternalContextEvidence>(),
            TokenExternalContextFailureReason.NoRelevantEvidence);

        public bool ThrowCancellation { get; set; }

        public bool RespectCallerCancellation { get; set; }

        public Task<TokenExternalContext> GetContextAsync(TokenInspection inspection, TokenIdentityProvenance? provenance, CancellationToken cancellationToken)
        {
            if (RespectCallerCancellation)
            {
                cancellationToken.ThrowIfCancellationRequested();
            }

            if (ThrowCancellation)
            {
                throw new OperationCanceledException("external context cancelled");
            }

            return Task.FromResult(Next);
        }
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

        public bool RespectCallerCancellation { get; set; }

        public AiSafetyCoachModelResult NextResult { get; set; } = new(
            false,
            null,
            AiSafetyCoachFailureReason.Disabled,
            "disabled");

        public Task<AiSafetyCoachModelResult> GenerateAsync(AiSafetyCoachInput input, CancellationToken cancellationToken)
        {
            if (RespectCallerCancellation)
            {
                cancellationToken.ThrowIfCancellationRequested();
            }

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

        public int LastReadCoachVersion { get; private set; }

        public Task<CachedTokenInspectionCoachSnapshot?> GetFreshAsync(
            string mint,
            string language,
            int coachVersion,
            string inputFingerprint,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken)
        {
            LastReadFingerprint = inputFingerprint;
            LastReadCoachVersion = coachVersion;

            if (ThrowOnRead)
            {
                throw new InvalidOperationException("cache read failure");
            }

            if (FreshSnapshot is not null
                && FreshSnapshot.Mint == mint
                && FreshSnapshot.Language == language
                && FreshSnapshot.CoachVersion == coachVersion
                && FreshSnapshot.ExpiresAtUtc > nowUtc
                && (string.IsNullOrEmpty(FreshSnapshot.InputFingerprint)
                    || FreshSnapshot.InputFingerprint == inputFingerprint))
            {
                return Task.FromResult<CachedTokenInspectionCoachSnapshot?>(FreshSnapshot);
            }

            var insertedMatch = Inserts
                .OrderByDescending(entry => entry.Coach.GeneratedAtUtc)
                .FirstOrDefault(entry => entry.Mint == mint
                    && entry.Language == language
                    && entry.CoachVersion == coachVersion
                    && entry.InputFingerprint == inputFingerprint
                    && entry.ExpiresAtUtc > nowUtc);

            if (insertedMatch is not null)
            {
                return Task.FromResult<CachedTokenInspectionCoachSnapshot?>(insertedMatch);
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