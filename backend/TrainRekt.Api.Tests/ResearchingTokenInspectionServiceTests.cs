using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class ResearchingTokenInspectionServiceTests
{
    [Fact]
    public async Task InspectAsync_DeterministicFailure_ReturnedUnchanged_AndResearchNotCalled()
    {
        var expected = TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderUnavailable, "provider unavailable");
        var inner = new StubInspectionService(expected);
        var orchestrator = new StubResearchOrchestrator(_ => throw new InvalidOperationException("should not be called"));
        var service = CreateService(inner, orchestrator);

        var result = await service.InspectAsync("mint", CancellationToken.None);

        Assert.Same(expected, result);
        Assert.Equal(0, orchestrator.CallCount);
    }

    [Fact]
    public async Task InspectAsync_ResearchNotRequired_ReturnsOriginalInspection()
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: true, freezeAuthorityRevoked: true, largestUnknownTokenAccountPercentage: null);
        var inner = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var orchestrator = new StubResearchOrchestrator(_ =>
            Task.FromResult(new ResearchOutcome(
                ResearchOutcomeStatus.NotRequired,
                Array.Empty<ResearchNeed>(),
                0,
                0,
                0,
                inspection.ProtocolContext,
                false)));
        var service = CreateService(inner, orchestrator);

        var result = await service.InspectAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Equal(0, result.Inspection!.ReviewSignals.Count);
        Assert.Equal(inspection.ProtocolContext, result.Inspection.ProtocolContext);
    }

    [Fact]
    public async Task InspectAsync_CompletedWithFinalContext_AppliesItAndRecomputesReviewSignals()
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false, protocolContext: null);
        var incomingContext = CreateContext(
            protocol: "external-research",
            claimId: ResearchClaimIds.DocumentedInflationaryIssuance,
            statement: "Ongoing issuance documented.",
            status: ResearchClaimVerificationStatus.Documented,
            method: ResearchClaimVerificationMethod.DocumentationOnly,
            consistency: ObservedConsistency.Consistent,
            sourceId: "src-doc");

        var inner = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var orchestrator = new StubResearchOrchestrator(_ =>
            Task.FromResult(new ResearchOutcome(
                ResearchOutcomeStatus.Completed,
                CreateNeeds(),
                SourcesAccepted: 1,
                ClaimsAccepted: 1,
                ClaimsRejected: 0,
                Context: incomingContext,
                UsedCache: false)));

        var service = CreateService(inner, orchestrator);

        var result = await service.InspectAsync(inspection.Identity.Mint, CancellationToken.None);

        var enriched = Assert.IsType<TokenInspection>(result.Inspection);
        Assert.Same(incomingContext, enriched.ProtocolContext);
        Assert.Contains(enriched.ReviewSignals, signal => signal.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE");
    }

    [Fact]
    public async Task InspectAsync_CompletedFinalContext_PreservesOrchestratorMergedDeterministicContext()
    {
        var deterministicContext = CreateContext(
            protocol: "deterministic",
            claimId: ResearchClaimIds.DocumentedInflationaryIssuance,
            statement: "Deterministically verified issuance.",
            status: ResearchClaimVerificationStatus.Verified,
            method: ResearchClaimVerificationMethod.DeterministicReconciliation,
            consistency: ObservedConsistency.Consistent,
            sourceId: "src-a");

        var finalContext = new ProtocolResearchContext(
            Protocol: deterministicContext.Protocol,
            Sources: deterministicContext.Sources.Concat(new[]
            {
                new ResearchSource(
                    Id: "src-b",
                    SourceType: ResearchSourceType.OfficialDocumentation,
                    Title: "Research doc",
                    Publisher: "Org",
                    Url: "https://example.com/research",
                    RetrievedAtUtc: null,
                    PublishedAtUtc: null)
            }).ToArray(),
            Claims: deterministicContext.Claims);

        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false, protocolContext: deterministicContext);
        var inner = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var orchestrator = new StubResearchOrchestrator(_ =>
            Task.FromResult(new ResearchOutcome(
                ResearchOutcomeStatus.Completed,
                CreateNeeds(),
                SourcesAccepted: 1,
                ClaimsAccepted: 1,
                ClaimsRejected: 0,
                Context: finalContext,
                UsedCache: false)));

        var service = CreateService(inner, orchestrator);

        var result = await service.InspectAsync(inspection.Identity.Mint, CancellationToken.None);

        var returnedInspection = Assert.IsType<TokenInspection>(result.Inspection);
        Assert.Same(finalContext, returnedInspection.ProtocolContext);
        Assert.Contains(returnedInspection.ProtocolContext!.Sources, source => source.Id == "src-b");
        var claim = Assert.Single(returnedInspection.ProtocolContext.Claims);
        Assert.Equal(ResearchClaimVerificationStatus.Verified, claim.VerificationStatus);
        Assert.Equal("Deterministically verified issuance.", claim.Statement);
    }

    [Fact]
    public async Task InspectAsync_ResearchFailedOutcome_ReturnsDeterministicInspection()
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);
        var inner = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var orchestrator = new StubResearchOrchestrator(_ =>
            Task.FromResult(new ResearchOutcome(
                ResearchOutcomeStatus.Failed,
                CreateNeeds(),
                0,
                0,
                0,
                inspection.ProtocolContext,
                false)));

        var service = CreateService(inner, orchestrator);

        var result = await service.InspectAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Equal(inspection.ProtocolContext, result.Inspection!.ProtocolContext);
    }

    [Theory]
    [InlineData(ResearchOutcomeStatus.NoUsableSources)]
    [InlineData(ResearchOutcomeStatus.InvalidCandidateData)]
    public async Task InspectAsync_ResearchWithoutUsableContext_ReturnsDeterministicInspection(ResearchOutcomeStatus status)
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);
        var inner = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var orchestrator = new StubResearchOrchestrator(_ =>
            Task.FromResult(new ResearchOutcome(
                status,
                CreateNeeds(),
                0,
                0,
                0,
                null,
                false)));

        var service = CreateService(inner, orchestrator);

        var result = await service.InspectAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Equal(inspection.ProtocolContext, result.Inspection!.ProtocolContext);
    }

    [Fact]
    public async Task InspectAsync_ResearchCancellation_Propagates()
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);
        var inner = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var orchestrator = new StubResearchOrchestrator(_ => throw new OperationCanceledException("cancelled"));
        var service = CreateService(inner, orchestrator);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.InspectAsync(inspection.Identity.Mint, CancellationToken.None));
    }

    [Fact]
    public async Task InspectAsync_FreshTokenInspectionCacheHit_StillRunsResearchWithoutDeterministicRerun()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var cachedInspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);
        var deterministic = new CountingDeterministicInspector(TokenInspectionResult.Success(cachedInspection));
        var tokenRepository = new InMemoryTokenRepository();
        var snapshotRepository = new InMemorySnapshotRepository(new CachedTokenInspectionSnapshot(
            Id: "1",
            Mint: cachedInspection.Identity.Mint,
            InspectedAtUtc: now.AddMinutes(-1),
            CachedAtUtc: now.AddMinutes(-1),
            AnalysisVersion: TokenInspectionAnalysisVersion.Current,
            ExpiresAtUtc: now.AddMinutes(4),
            Result: cachedInspection));

        var cachedService = new CachedTokenInspectionService(
            deterministic,
            tokenRepository,
            snapshotRepository,
            Options.Create(new TokenInspectionCacheOptions { FreshnessMinutes = 5 }),
            new FixedTimeProvider(now),
            NullLogger<CachedTokenInspectionService>.Instance);

        var orchestrator = new StubResearchOrchestrator(_ =>
            Task.FromResult(new ResearchOutcome(
                ResearchOutcomeStatus.NoUsableSources,
                CreateNeeds(),
                0,
                0,
                0,
                cachedInspection.ProtocolContext,
                true)));

        var service = CreateService(cachedService, orchestrator);

        var result = await service.InspectAsync(cachedInspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Equal(0, deterministic.CallCount);
        Assert.Equal(1, orchestrator.CallCount);
    }

    private static ResearchingTokenInspectionService CreateService(
        ITokenInspectionService inner,
        ITokenResearchOrchestrator orchestrator)
    {
        return new ResearchingTokenInspectionService(
            inner,
            orchestrator,
            NullLogger<ResearchingTokenInspectionService>.Instance);
    }

    private static IReadOnlyList<ResearchNeed> CreateNeeds()
    {
        return new[]
        {
            new ResearchNeed(
                Id: "NEED",
                Category: ResearchNeedCategory.ActiveMintAuthorityWithoutContext,
                Priority: ResearchNeedPriority.High,
                ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                Reason: "reason")
        };
    }

    private static ProtocolResearchContext CreateContext(
        string protocol,
        string claimId,
        string statement,
        ResearchClaimVerificationStatus status,
        ResearchClaimVerificationMethod method,
        ObservedConsistency consistency,
        string sourceId)
    {
        return new ProtocolResearchContext(
            Protocol: protocol,
            Sources: new[]
            {
                new ResearchSource(
                    Id: sourceId,
                    SourceType: ResearchSourceType.OfficialDocumentation,
                    Title: "Doc",
                    Publisher: "Org",
                    Url: "https://example.com/doc",
                    RetrievedAtUtc: null,
                    PublishedAtUtc: null)
            },
            Claims: new[]
            {
                new DocumentedClaim(
                    Id: claimId,
                    Category: "issuance",
                    Statement: statement,
                    VerificationStatus: status,
                    VerificationMethod: method,
                    SourceIds: new[] { sourceId },
                    ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                    VerificationNote: null,
                    Consistency: consistency)
            });
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

    private sealed class StubResearchOrchestrator : ITokenResearchOrchestrator
    {
        private readonly Func<TokenInspection, Task<ResearchOutcome>> _handler;

        public StubResearchOrchestrator(Func<TokenInspection, Task<ResearchOutcome>> handler)
        {
            _handler = handler;
        }

        public int CallCount { get; private set; }

        public Task<ResearchOutcome> RunAsync(TokenInspection inspection, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            CallCount++;
            return _handler(inspection);
        }
    }

    private sealed class CountingDeterministicInspector : ITokenInspectionDeterministicService
    {
        private readonly TokenInspectionResult _result;

        public CountingDeterministicInspector(TokenInspectionResult result)
        {
            _result = result;
        }

        public int CallCount { get; private set; }

        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            CallCount++;
            return Task.FromResult(_result);
        }
    }

    private sealed class InMemoryTokenRepository : ITokenRepository
    {
        public Task<CachedToken?> GetByMintAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult<CachedToken?>(null);
        }

        public Task UpsertAsync(CachedToken token, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }

    private sealed class InMemorySnapshotRepository : ITokenInspectionSnapshotRepository
    {
        private readonly CachedTokenInspectionSnapshot _snapshot;

        public InMemorySnapshotRepository(CachedTokenInspectionSnapshot snapshot)
        {
            _snapshot = snapshot;
        }

        public Task<CachedTokenInspectionSnapshot?> GetLatestFreshAsync(string mint, int analysisVersion, DateTimeOffset nowUtc, CancellationToken cancellationToken)
        {
            return Task.FromResult<CachedTokenInspectionSnapshot?>(
                _snapshot.Mint == mint
                && _snapshot.AnalysisVersion == analysisVersion
                && _snapshot.ExpiresAtUtc > nowUtc
                    ? _snapshot
                    : null);
        }

        public Task<CachedTokenInspectionSnapshot?> GetLatestByMintAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult<CachedTokenInspectionSnapshot?>(_snapshot.Mint == mint ? _snapshot : null);
        }

        public Task InsertAsync(CachedTokenInspectionSnapshot snapshot, CancellationToken cancellationToken)
        {
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
