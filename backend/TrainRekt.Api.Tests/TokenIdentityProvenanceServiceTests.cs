using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenIdentityProvenanceServiceTests
{
    [Fact]
    public async Task AnalyzeAsync_InspectionFailure_ReturnsInspectionErrorAndSkipsRepository()
    {
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Failure(TokenInspectionErrorCode.InvalidMint, "bad"));
        var repository = new StubObservationRepository();
        var service = CreateService(inspectionService, repository, new StubChronologyService());

        var result = await service.AnalyzeAsync("bad", CancellationToken.None);

        Assert.NotNull(result.InspectionError);
        Assert.Null(result.Provenance);
        Assert.Equal(0, repository.UpsertCount);
        Assert.Equal(0, repository.FindCount);
    }

    [Fact]
    public async Task AnalyzeAsync_WithNoCollisions_ReturnsNoMeaningfulCollisionFound()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(0, Array.Empty<TokenIdentityObservation>())
        };

        var service = CreateService(inspectionService, repository, new StubChronologyService());

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.NoMeaningfulCollisionFound, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.High, result.Provenance.Confidence);
        Assert.False(result.Provenance.IsTruncated);
    }

    [Fact]
    public async Task AnalyzeAsync_WithExactCollision_ReturnsCollisionObserved()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                1,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint222",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: now.AddMinutes(-30),
                        LastObservedAtUtc: now.AddMinutes(-10),
                        ObservationVersion: 1)
                })
        };

        var service = CreateService(inspectionService, repository, new StubChronologyService(), time: now);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.CollisionObserved, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.High, result.Provenance.Confidence);
        Assert.Single(result.Provenance.Collisions);
        Assert.Equal(TokenIdentityMatchLevel.Exact, result.Provenance.Collisions[0].MatchLevel);
        Assert.NotNull(result.Provenance.EarliestObservedMatch);
    }

    [Fact]
    public async Task AnalyzeAsync_WithNormalizedOnlyCollision_ReturnsAmbiguousLowConfidence()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                1,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint333",
                        RawName: "research-token",
                        NormalizedName: "research token",
                        RawSymbol: "r ch",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-15),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-1),
                        ObservationVersion: 1)
                })
        };

        var service = CreateService(inspectionService, repository, new StubChronologyService());

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.Ambiguous, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.Low, result.Provenance.Confidence);
        Assert.Equal(TokenIdentityMatchLevel.NormalizedExact, result.Provenance.Collisions[0].MatchLevel);
    }

    [Fact]
    public async Task AnalyzeAsync_WithMissingNameAndSymbol_ReturnsInsufficientEvidenceAndUnknown()
    {
        var inspection = CreateInspection("Mint111", null, null);
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository();
        var service = CreateService(inspectionService, repository, new StubChronologyService());

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.InsufficientEvidence, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.None, result.Provenance.Confidence);
        Assert.Contains(TokenIdentityProvenanceUnknown.ScannedIdentityFieldsMissing, result.Provenance.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_WithTruncatedResults_LowersCollisionConfidence()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                3,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint222",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-20),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-10),
                        ObservationVersion: 1)
                })
        };

        var service = CreateService(inspectionService, repository, new StubChronologyService(), options: new TokenIdentityProvenanceOptions { MaxReturnedCollisions = 1 });

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.CollisionObserved, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.Medium, result.Provenance.Confidence);
        Assert.True(result.Provenance.IsTruncated);
        Assert.Equal(3, result.Provenance.TotalCollisionCount);
        Assert.Equal(1, result.Provenance.ReturnedCollisionCount);
    }

    [Fact]
    public async Task AnalyzeAsync_RepositoryFailure_ReturnsPersistenceUnavailable()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository { ThrowOnUpsert = true };
        var service = CreateService(inspectionService, repository, new StubChronologyService());

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.InspectionError);
        Assert.Equal(TokenInspectionErrorCode.PersistenceUnavailable, result.InspectionError!.Code);
        Assert.Null(result.Provenance);
    }

    [Fact]
    public async Task AnalyzeAsync_RepositoryCancellation_Propagates()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository { ThrowCancellation = true };
        var service = CreateService(inspectionService, repository, new StubChronologyService());

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None));
    }

    [Fact]
    public async Task AnalyzeAsync_DoesNotMutateInspectionOrProtocolContext()
    {
        var protocolContext = new ProtocolResearchContext("protocol", Array.Empty<ResearchSource>(), Array.Empty<DocumentedClaim>());
        var inspection = CreateInspection("Mint111", "Research Token", "RCH", protocolContext);
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository();
        var service = CreateService(inspectionService, repository, new StubChronologyService());

        _ = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Same(protocolContext, inspection.ProtocolContext);
        Assert.Equal("Research Token", inspection.Identity.Name);
        Assert.Equal("RCH", inspection.Identity.Symbol);
    }

    [Fact]
    public async Task AnalyzeAsync_ChronologyEvidence_RemovesOnChainCreationOrderUnknownAndAddsChronology()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var chronology = new OnChainChronologyEvidence(
            EarliestObservedSignature: "sig-1",
            EarliestObservedSlot: 123,
            EarliestObservedBlockTimeUtc: DateTimeOffset.UtcNow,
            HistoryCoverage: OnChainChronologyCoverage.CompleteWithinProviderResult,
            PaginationExhausted: true,
            PagesScanned: 1,
            SignaturesScanned: 2,
            Source: "HELIUS_SOLANA_RPC",
            Confidence: OnChainChronologyConfidence.High,
            Precision: OnChainChronologyPrecision.BlockTime,
            AccountCreationProven: false,
            Unknowns: new[]
            {
                OnChainChronologyUnknown.CanonicalCreationTimeNotProven,
                OnChainChronologyUnknown.ProviderRetentionUnknown
            },
            AnalyzedAtUtc: DateTimeOffset.UtcNow);

        var service = CreateService(
            inspectionService,
            new StubObservationRepository(),
            new StubChronologyService { NextEvidence = chronology });

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.NotNull(result.Provenance!.OnChainChronology);
        Assert.DoesNotContain(TokenIdentityProvenanceUnknown.OnChainCreationOrderNotVerified, result.Provenance.Unknowns);
        Assert.Contains(TokenIdentityProvenanceUnknown.CanonicalCreationTimeNotProven, result.Provenance.Unknowns);
        Assert.Contains(TokenIdentityProvenanceUnknown.ProviderRetentionUnknown, result.Provenance.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_ChronologyFailure_DoesNotEraseObservedCollisionEvidence()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                1,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint222",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-20),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-10),
                        ObservationVersion: 1)
                })
        };

        var service = CreateService(
            inspectionService,
            repository,
            new StubChronologyService { ThrowUnexpected = true });

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.CollisionObserved, result.Provenance!.Result);
        Assert.Single(result.Provenance.Collisions);
        Assert.NotNull(result.Provenance.OnChainChronology);
        Assert.Equal(OnChainChronologyCoverage.Unavailable, result.Provenance.OnChainChronology!.HistoryCoverage);
    }

    [Fact]
    public async Task AnalyzeAsync_TrustedSourceReferencesScannedMint_RemovesOfficialIdentityUnknown()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository();
        var trusted = new StubTrustedIdentityProvenanceService
        {
            NextResult = new TrustedIdentityProvenance(
                Sources: new[]
                {
                    new IdentitySourceEvidence(
                        Url: "https://trusted.example/project",
                        Publisher: "Trusted Publisher",
                        SourceTrust: IdentitySourceTrust.Trusted,
                        MintLinkStatus: IdentityMintLinkStatus.ReferencesScannedMint,
                        ReferencedRelevantMints: new[] { "Mint111" },
                        EvidenceSummary: "A trusted project source references this exact mint.")
                },
                Evidence: new[]
                {
                    new TokenIdentityProvenanceEvidence("TRUSTED_SOURCE_REFERENCES_SCANNED_MINT", "Trusted source references scanned mint.")
                },
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow)
        };

        var service = CreateService(inspectionService, repository, new StubChronologyService(), trustedService: trusted);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.DoesNotContain(TokenIdentityProvenanceUnknown.OfficialIdentityNotVerified, result.Provenance!.Unknowns);
        Assert.NotNull(result.Provenance.TrustedIdentityProvenance);
        Assert.Single(result.Provenance.TrustedIdentityProvenance!.Sources);
    }

    [Fact]
    public async Task AnalyzeAsync_TrustedIdentityConflict_PromotesResultToAmbiguous()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                1,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint222",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-20),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-10),
                        ObservationVersion: 1)
                })
        };

        var trusted = new StubTrustedIdentityProvenanceService
        {
            NextResult = new TrustedIdentityProvenance(
                Sources: new[]
                {
                    new IdentitySourceEvidence(
                        Url: "https://trusted.example/project",
                        Publisher: "Trusted Publisher",
                        SourceTrust: IdentitySourceTrust.Trusted,
                        MintLinkStatus: IdentityMintLinkStatus.ReferencesCompetingMint,
                        ReferencedRelevantMints: new[] { "Mint222" },
                        EvidenceSummary: "A trusted project source references another observed mint using the same identity.")
                },
                Evidence: new[]
                {
                    new TokenIdentityProvenanceEvidence("TRUSTED_SOURCE_REFERENCES_COMPETING_MINT", "Trusted source references competing mint.")
                },
                Conflicts: new[]
                {
                    new TokenIdentityProvenanceEvidence("TRUSTED_SOURCE_REFERENCES_COMPETING_MINT", "Trusted source references competing mint.")
                },
                Unknowns: new[] { TrustedIdentityProvenanceUnknown.IdentitySourceConflict },
                AnalyzedAtUtc: DateTimeOffset.UtcNow)
        };

        var service = CreateService(inspectionService, repository, new StubChronologyService(), trustedService: trusted);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.Ambiguous, result.Provenance!.Result);
        Assert.Contains(TokenIdentityProvenanceUnknown.IdentitySourceConflict, result.Provenance.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_NoCollision_DoesNotFetchCompetitorChronology()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(0, Array.Empty<TokenIdentityObservation>())
        };

        var chronology = new StubChronologyService();
        var service = CreateService(inspectionService, repository, chronology);

        _ = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Equal(1, chronology.CallCount);
    }

    [Fact]
    public async Task AnalyzeAsync_CollisionWithoutTrustedCompetitorEvidence_DoesNotFetchCompetitorChronology()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                1,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint222",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-20),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-10),
                        ObservationVersion: 1)
                })
        };

        var chronology = new StubChronologyService();
        var trusted = new StubTrustedIdentityProvenanceService
        {
            NextResult = new TrustedIdentityProvenance(
                Sources: new[]
                {
                    new IdentitySourceEvidence(
                        Url: "https://project.example",
                        Publisher: "project",
                        SourceTrust: IdentitySourceTrust.ClaimedProjectSource,
                        MintLinkStatus: IdentityMintLinkStatus.ReferencesCompetingMint,
                        ReferencedRelevantMints: new[] { "Mint222" },
                        EvidenceSummary: "claimed")
                },
                Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow)
        };

        var service = CreateService(inspectionService, repository, chronology, trustedService: trusted);

        _ = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Equal(1, chronology.CallCount);
    }

    [Fact]
    public async Task AnalyzeAsync_TrustedCompetitorEvidence_FetchesAtMostOneCompetitorChronology()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                2,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint222",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-20),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-10),
                        ObservationVersion: 1),
                    new TokenIdentityObservation(
                        Mint: "Mint333",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-19),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-9),
                        ObservationVersion: 1)
                })
        };

        var chronology = new StubChronologyService();
        var trusted = new StubTrustedIdentityProvenanceService
        {
            NextResult = new TrustedIdentityProvenance(
                Sources: new[]
                {
                    new IdentitySourceEvidence(
                        Url: "https://trusted.example",
                        Publisher: "trusted",
                        SourceTrust: IdentitySourceTrust.Trusted,
                        MintLinkStatus: IdentityMintLinkStatus.ReferencesCompetingMint,
                        ReferencedRelevantMints: new[] { "Mint222" },
                        EvidenceSummary: "trusted competitor")
                },
                Evidence: new[] { new TokenIdentityProvenanceEvidence("TRUSTED_SOURCE_REFERENCES_COMPETING_MINT", "trusted competitor") },
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow)
        };

        var service = CreateService(inspectionService, repository, chronology, trustedService: trusted);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Equal(2, chronology.CallCount);
        Assert.NotNull(result.Provenance);
        Assert.NotNull(result.Provenance!.IdentityClassification);
    }

    [Fact]
    public async Task AnalyzeAsync_ExecutesChronologyAndTrustedIdentityStagesConcurrently()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubDeterministicInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(0, Array.Empty<TokenIdentityObservation>())
        };

        var chronologyStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var chronologyRelease = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var trustedStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var trustedRelease = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        var chronology = new StubChronologyService
        {
            StartedSignal = chronologyStarted,
            ReleaseSignal = chronologyRelease,
        };

        var trusted = new StubTrustedIdentityProvenanceService
        {
            StartedSignal = trustedStarted,
            ReleaseSignal = trustedRelease,
        };

        var service = CreateService(inspectionService, repository, chronology, trustedService: trusted);

        var analyzeTask = service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        await Task.WhenAll(chronologyStarted.Task, trustedStarted.Task);
        Assert.False(analyzeTask.IsCompleted);

        chronologyRelease.SetResult(true);
        trustedRelease.SetResult(true);

        var result = await analyzeTask;
        Assert.NotNull(result.Provenance);
        Assert.Equal(1, chronology.CallCount);
        Assert.Equal(1, trusted.CallCount);
    }

    private static TokenInspection CreateInspection(string mint, string? name, string? symbol, ProtocolResearchContext? protocolContext = null)
    {
        var baseInspection = ResearchTestData.CreateInspection(protocolContext: protocolContext);
        return baseInspection with
        {
            Identity = baseInspection.Identity with
            {
                Mint = mint,
                Name = name,
                Symbol = symbol
            }
        };
    }

    private static TokenIdentityProvenanceService CreateService(
        ITokenInspectionCoreService inspectionService,
        ITokenIdentityObservationRepository observationRepository,
        IOnChainChronologyService chronologyService,
        ITrustedIdentityProvenanceService? trustedService = null,
        TokenIdentityProvenanceOptions? options = null,
        DateTimeOffset? time = null)
    {
        options ??= new TokenIdentityProvenanceOptions { MaxReturnedCollisions = 25 };
        trustedService ??= new StubTrustedIdentityProvenanceService();
        var now = time ?? new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);

        return new TokenIdentityProvenanceService(
            inspectionService,
            observationRepository,
            chronologyService,
            trustedService,
            new TokenIdentityClassifier(),
            new TokenIdentityNormalizer(),
            Options.Create(options),
            Options.Create(new TokenIdentityClassificationOptions { MaxClassificationCompetitors = 1 }),
            new FixedTimeProvider(now),
            NullLogger<TokenIdentityProvenanceService>.Instance);
    }

    private sealed class StubDeterministicInspectionService : ITokenInspectionDeterministicService, ITokenInspectionCoreService
    {
        private readonly TokenInspectionResult _result;

        public StubDeterministicInspectionService(TokenInspectionResult result)
        {
            _result = result;
        }

        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult(_result);
        }
    }

    private sealed class StubChronologyService : IOnChainChronologyService
    {
        public TaskCompletionSource<bool>? StartedSignal { get; set; }

        public TaskCompletionSource<bool>? ReleaseSignal { get; set; }

        public OnChainChronologyEvidence NextEvidence { get; set; } = new(
            EarliestObservedSignature: null,
            EarliestObservedSlot: null,
            EarliestObservedBlockTimeUtc: null,
            HistoryCoverage: OnChainChronologyCoverage.Unavailable,
            PaginationExhausted: false,
            PagesScanned: 0,
            SignaturesScanned: 0,
            Source: "HELIUS_SOLANA_RPC",
            Confidence: OnChainChronologyConfidence.None,
            Precision: OnChainChronologyPrecision.ObservedTransactionOnly,
            AccountCreationProven: false,
            Unknowns: new[]
            {
                OnChainChronologyUnknown.CanonicalCreationTimeNotProven,
                OnChainChronologyUnknown.ChainHistoryUnavailable
            },
            AnalyzedAtUtc: DateTimeOffset.UtcNow);

        public bool ThrowUnexpected { get; set; }

        public int CallCount { get; private set; }

        public Task<OnChainChronologyEvidence> AnalyzeAsync(string mint, CancellationToken cancellationToken)
        {
            CallCount += 1;

            StartedSignal?.TrySetResult(true);

            if (ThrowUnexpected)
            {
                throw new InvalidOperationException("chronology failed");
            }

            if (ReleaseSignal is not null)
            {
                return WaitForReleaseThenReturnEvidenceAsync(cancellationToken);
            }

            return Task.FromResult(NextEvidence);
        }

        private async Task<OnChainChronologyEvidence> WaitForReleaseThenReturnEvidenceAsync(CancellationToken cancellationToken)
        {
            await ReleaseSignal!.Task.WaitAsync(cancellationToken);
            return NextEvidence;
        }
    }

    private sealed class StubObservationRepository : ITokenIdentityObservationRepository
    {
        public bool ThrowOnUpsert { get; set; }

        public bool ThrowCancellation { get; set; }

        public int UpsertCount { get; private set; }

        public int FindCount { get; private set; }

        public TokenIdentityObservationQueryResult QueryResult { get; set; } =
            new(0, Array.Empty<TokenIdentityObservation>());

        public Task<TokenIdentityObservation?> GetByMintAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult<TokenIdentityObservation?>(null);
        }

        public Task UpsertAsync(TokenIdentityObservation observation, CancellationToken cancellationToken)
        {
            if (ThrowCancellation)
            {
                throw new OperationCanceledException("cancelled");
            }

            if (ThrowOnUpsert)
            {
                throw new InvalidOperationException("upsert failed");
            }

            UpsertCount += 1;
            return Task.CompletedTask;
        }

        public Task<TokenIdentityObservationQueryResult> FindCollisionsAsync(
            string excludingMint,
            string? normalizedName,
            string? normalizedSymbol,
            int limit,
            CancellationToken cancellationToken)
        {
            if (ThrowCancellation)
            {
                throw new OperationCanceledException("cancelled");
            }

            FindCount += 1;
            return Task.FromResult(QueryResult);
        }
    }

    private sealed class StubTrustedIdentityProvenanceService : ITrustedIdentityProvenanceService
    {
        public int CallCount { get; private set; }

        public TaskCompletionSource<bool>? StartedSignal { get; set; }

        public TaskCompletionSource<bool>? ReleaseSignal { get; set; }

        public TrustedIdentityProvenance NextResult { get; set; } = new(
            Sources: Array.Empty<IdentitySourceEvidence>(),
            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Unknowns: new[]
            {
                TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable,
                TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified
            },
            AnalyzedAtUtc: DateTimeOffset.UtcNow);

        public Task<TrustedIdentityProvenance> AnalyzeAsync(
            TrustedIdentityProvenanceRequest request,
            CancellationToken cancellationToken)
        {
            CallCount += 1;
            StartedSignal?.TrySetResult(true);

            if (ReleaseSignal is not null)
            {
                return WaitForReleaseThenReturnResultAsync(cancellationToken);
            }

            return Task.FromResult(NextResult);
        }

        private async Task<TrustedIdentityProvenance> WaitForReleaseThenReturnResultAsync(CancellationToken cancellationToken)
        {
            await ReleaseSignal!.Task.WaitAsync(cancellationToken);
            return NextResult;
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
