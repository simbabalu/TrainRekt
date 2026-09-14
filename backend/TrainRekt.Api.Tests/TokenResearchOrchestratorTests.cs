using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenResearchOrchestratorTests
{
    [Fact]
    public async Task RunAsync_NoNeeds_DoesNotCallProvider()
    {
        var provider = new FakeProvider(CreateEmptyCandidateResult());
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository);
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: true, freezeAuthorityRevoked: true, largestUnknownTokenAccountPercentage: null);

        var outcome = await orchestrator.RunAsync(inspection, CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.NotRequired, outcome.Status);
        Assert.Equal(ResearchAvailability.NotAttempted, outcome.Availability);
        Assert.Equal(0, provider.CallCount);
        Assert.Equal(0, repository.GetLatestFreshCallCount);
    }

    [Fact]
    public async Task RunAsync_ResearchCacheReadFailure_ReturnsFailedWithoutProviderCall()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository { ThrowOnFreshRead = true };
        var orchestrator = CreateOrchestrator(provider, repository);

        var outcome = await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.Failed, outcome.Status);
        Assert.Equal(0, provider.CallCount);
    }

    [Fact]
    public async Task RunAsync_WithNeeds_CallsProviderOnce()
    {
        var provider = new FakeProvider(CreateEmptyCandidateResult());
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository);
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);

        await orchestrator.RunAsync(inspection, CancellationToken.None);

        Assert.Equal(1, provider.CallCount);
    }

    [Fact]
    public async Task RunAsync_EmptyProviderResult_ReturnsNoUsableSources()
    {
        var provider = new FakeProvider(CreateEmptyCandidateResult());
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository);
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);

        var outcome = await orchestrator.RunAsync(inspection, CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.NoUsableSources, outcome.Status);
        Assert.Equal(ResearchAvailability.Partial, outcome.Availability);
        Assert.Equal(0, repository.InsertCount);
    }

    [Fact]
    public async Task RunAsync_ValidProviderResult_PromotesContext()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository, CreateTrustedAssessment());
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);

        var outcome = await orchestrator.RunAsync(inspection, CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.Completed, outcome.Status);
        Assert.Equal(ResearchAvailability.Complete, outcome.Availability);
        Assert.NotNull(outcome.Context);
        var claim = Assert.Single(outcome.Context.Claims);
        Assert.Equal(ResearchClaimVerificationStatus.Documented, claim.VerificationStatus);
        Assert.Equal(ObservedConsistency.Consistent, claim.Consistency);
        Assert.Equal(1, repository.InsertCount);
    }

    [Fact]
    public async Task RunAsync_InvalidProviderResult_ReturnsInvalidCandidateData()
    {
        var candidate = CreateValidCandidateResult() with
        {
            Sources = new[]
            {
                CreateSource("dup"),
                CreateSource("dup")
            }
        };

        var provider = new FakeProvider(candidate);
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository);

        var outcome = await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.InvalidCandidateData, outcome.Status);
        Assert.Equal(ResearchAvailability.Partial, outcome.Availability);
        Assert.Equal(0, repository.InsertCount);
    }

    [Fact]
    public async Task RunAsync_Cancellation_Propagates()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository { ThrowOnReadIfCancelled = true };
        var orchestrator = CreateOrchestrator(provider, repository);
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), cts.Token));
    }

    [Fact]
    public async Task RunAsync_FreshResearch_IsReusedFromCache()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository
        {
            FreshSnapshot = CreateSnapshot(DateTimeOffset.UtcNow.AddHours(1))
        };

        var orchestrator = CreateOrchestrator(provider, repository);

        var outcome = await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.Completed, outcome.Status);
        Assert.Equal(ResearchAvailability.Complete, outcome.Availability);
        Assert.True(outcome.UsedCache);
        Assert.Equal(0, provider.CallCount);
    }

    [Fact]
    public async Task RunAsync_ExpiredResearch_IsStaleAndProviderIsCalled()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository { FreshSnapshot = null };
        var orchestrator = CreateOrchestrator(provider, repository);

        await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(1, provider.CallCount);
    }

    [Fact]
    public async Task RunAsync_StoresResearchVersionOnPersistedSnapshot()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository, CreateTrustedAssessment());

        await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(TokenResearchVersion.Current, repository.Inserted.Single().ResearchVersion);
        Assert.Equal(TokenResearchVersion.Current, repository.LastFreshLookupResearchVersion);
    }

    [Fact]
    public async Task RunAsync_ProviderThrowsUnexpected_ReturnsFailed()
    {
        var provider = new FakeProvider(CreateValidCandidateResult())
        {
            ThrowOnResearch = true
        };
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository, CreateTrustedAssessment());

        var outcome = await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.Failed, outcome.Status);
        Assert.Equal(ResearchAvailability.Unavailable, outcome.Availability);
    }

    [Fact]
    public async Task RunAsync_ProviderTimeoutCancellation_ReturnsFailedWithoutThrowing()
    {
        var provider = new FakeProvider(CreateValidCandidateResult())
        {
            ThrowOperationCanceled = true
        };

        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository, CreateTrustedAssessment());

        var outcome = await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.Failed, outcome.Status);
        Assert.Equal(ResearchAvailability.Unavailable, outcome.Availability);
        Assert.Equal(ResearchFailureCategory.Timeout, outcome.FailureCategory);
    }

    [Fact]
    public async Task RunAsync_TrustAssessorThrowsUnexpected_ReturnsFailed()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(
            provider,
            repository,
            createTrustAssessor: _ => new ThrowingTrustAssessor());

        var outcome = await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.Failed, outcome.Status);
        Assert.Equal(ResearchAvailability.Unavailable, outcome.Availability);
    }

    [Fact]
    public async Task RunAsync_InsertFailure_ReturnsCompletedWithCurrentEnrichment()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository { ThrowOnInsert = true };
        var orchestrator = CreateOrchestrator(provider, repository, CreateTrustedAssessment());

        var outcome = await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.Completed, outcome.Status);
        Assert.NotNull(outcome.Context);
        Assert.Equal(1, repository.InsertCount);
    }

    [Fact]
    public async Task RunAsync_WithoutTrustedAssessment_FailsClosed()
    {
        var provider = new FakeProvider(CreateValidCandidateResult());
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestrator(provider, repository, CreateFailClosedAssessment());

        var outcome = await orchestrator.RunAsync(ResearchTestData.CreateInspection(mintAuthorityRevoked: false), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.NoUsableSources, outcome.Status);
        Assert.Equal(ResearchAvailability.Partial, outcome.Availability);
        Assert.Equal(0, repository.InsertCount);
    }

    [Fact]
    public async Task RunAsync_GeminiClaimedOfficialCanonicalOnUntrustedMintSource_FailsClosed()
    {
        var mint = ProtocolConstants.SolanaMobileSkrMint;
        var candidate = CreateGeminiLikeCandidateResult(
            mint,
            sourceUrl: "https://untrusted.example/skr-docs",
            claimedSourceType: ResearchSourceType.OfficialDocumentation,
            claimedCanonicalProjectWebsite: true);

        var provider = new FakeProvider(candidate);
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestratorWithProductionAssessor(
            provider,
            repository,
            source => SuccessFetch(source.Url, "text/plain", $"mint={mint}"));

        var outcome = await orchestrator.RunAsync(CreateInspectionForMint(mint), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.NoUsableSources, outcome.Status);
        Assert.Equal(ResearchAvailability.Partial, outcome.Availability);
        Assert.Null(outcome.Context);
        Assert.Equal(0, repository.InsertCount);
    }

    [Fact]
    public async Task RunAsync_TrustedRegistrySourceWithExactMint_PromotesDocumentedOnly()
    {
        var mint = ProtocolConstants.SolanaMobileSkrMint;
        var candidate = CreateGeminiLikeCandidateResult(
            mint,
            sourceUrl: "https://docs.solanamobile.com/solana-mobile-stack/skr",
            claimedSourceType: ResearchSourceType.OfficialDocumentation,
            claimedCanonicalProjectWebsite: true);

        var provider = new FakeProvider(candidate);
        var repository = new FakeRepository();
        var orchestrator = CreateOrchestratorWithProductionAssessor(
            provider,
            repository,
            source => SuccessFetch(source.Url, "text/plain", $"mint={mint}"));

        var outcome = await orchestrator.RunAsync(CreateInspectionForMint(mint), CancellationToken.None);

        Assert.Equal(ResearchOutcomeStatus.Completed, outcome.Status);
        Assert.Equal(ResearchAvailability.Complete, outcome.Availability);
        Assert.NotNull(outcome.Context);
        Assert.Single(outcome.Context!.Sources);
        Assert.Equal(ResearchSourceType.OfficialDocumentation, outcome.Context.Sources[0].SourceType);

        var claim = Assert.Single(outcome.Context.Claims);
        Assert.Equal(ResearchClaimVerificationStatus.Documented, claim.VerificationStatus);
        Assert.Equal(ResearchClaimVerificationMethod.DocumentationOnly, claim.VerificationMethod);
        Assert.NotEqual(ResearchClaimVerificationMethod.DeterministicReconciliation, claim.VerificationMethod);
        Assert.NotEqual(ResearchClaimVerificationStatus.Verified, claim.VerificationStatus);
    }

    private static TokenResearchOrchestrator CreateOrchestrator(
        FakeProvider provider,
        FakeRepository repository,
        ResearchTrustAssessment? assessment = null,
        Func<ResearchTrustAssessment?, IResearchTrustAssessor>? createTrustAssessor = null)
    {
        var options = Options.Create(new TokenResearchOptions
        {
            FreshnessHours = 24,
            LargestUnknownTokenAccountThresholdPercent = 10m,
            MaxSources = 16,
            MaxClaims = 32,
            MaxStatementLength = 600,
            MaxUrlLength = 2048,
            MaxTitleLength = 160,
            MaxPublisherLength = 120,
            ProviderTimeoutSeconds = 8,
            AcceptCanonicalProjectWebsite = true
        });

        return new TokenResearchOrchestrator(
            provider,
            (createTrustAssessor ?? (resolvedAssessment => new FakeTrustAssessor(resolvedAssessment ?? CreateFailClosedAssessment())))(assessment),
            repository,
            new ResearchNeedDetector(options.Value),
            new ResearchRequestFactory(),
            new CandidateResearchPromoter(options.Value),
            new DeterministicResearchVerifier(),
            new ProtocolResearchContextMerger(),
            TimeProvider.System,
            options,
            NullLogger<TokenResearchOrchestrator>.Instance);
    }

    private static CandidateResearchResult CreateEmptyCandidateResult()
    {
        return new CandidateResearchResult(
            IdentityEvidence: Array.Empty<CandidateIdentityEvidence>(),
            Sources: Array.Empty<CandidateResearchSource>(),
            Claims: Array.Empty<CandidateDocumentedClaim>());
    }

    private static CandidateResearchResult CreateValidCandidateResult()
    {
        return new CandidateResearchResult(
            IdentityEvidence: new[]
            {
                new CandidateIdentityEvidence(ResearchIdentityEvidenceType.MintAddressMentioned, "ResearchMint1111111111111111111111111111111", null)
            },
            Sources: new[] { CreateSource("src") },
            Claims: new[]
            {
                new CandidateDocumentedClaim(
                    Id: ResearchClaimIds.DocumentedInflationaryIssuance,
                    Category: "issuance",
                    Statement: "Ongoing issuance is documented.",
                    SourceIds: new[] { "src" },
                    ObservedFactReferences: new[]
                    {
                        new ObservedFactReference(ObservedFactIds.MintAuthorityActive, "true", "true", null)
                    },
                    ExtractionNote: "from docs")
            });
    }

    private static CandidateResearchResult CreateGeminiLikeCandidateResult(
        string mint,
        string sourceUrl,
        ResearchSourceType claimedSourceType,
        bool claimedCanonicalProjectWebsite)
    {
        return new CandidateResearchResult(
            IdentityEvidence: new[]
            {
                new CandidateIdentityEvidence(ResearchIdentityEvidenceType.MintAddressMentioned, mint, "provider extracted exact mint")
            },
            Sources: new[]
            {
                new CandidateResearchSource(
                    Id: "src",
                    ClaimedSourceType: claimedSourceType,
                    Title: "Gemini source",
                    Publisher: "Unverified",
                    Url: sourceUrl,
                    ClaimedCanonicalProjectWebsite: claimedCanonicalProjectWebsite,
                    PublishedAtUtc: null)
            },
            Claims: new[]
            {
                new CandidateDocumentedClaim(
                    Id: ResearchClaimIds.DocumentedInflationaryIssuance,
                    Category: "issuance",
                    Statement: "Issuance is documented by source.",
                    SourceIds: new[] { "src" },
                    ObservedFactReferences: new[]
                    {
                        new ObservedFactReference(ObservedFactIds.MintAuthorityActive, "true", "true", null)
                    },
                    ExtractionNote: "gemini claim")
            });
    }

    private static CandidateResearchSource CreateSource(string id)
    {
        return new CandidateResearchSource(
            Id: id,
            ClaimedSourceType: ResearchSourceType.OfficialDocumentation,
            Title: "Docs",
            Publisher: "Org",
            Url: "https://example.com/docs",
            ClaimedCanonicalProjectWebsite: false,
            PublishedAtUtc: null);
    }

    private static ResearchTrustAssessment CreateFailClosedAssessment()
    {
        return new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Unconfirmed, false, new[] { "fail closed" }),
            Sources: Array.Empty<AssessedResearchSource>());
    }

    private static ResearchTrustAssessment CreateTrustedAssessment()
    {
        return new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Confirmed, true, new[] { "trusted mint evidence" }),
            Sources: new[]
            {
                new AssessedResearchSource(
                    CandidateSourceId: "src",
                    Decision: ResearchSourceAssessmentDecision.Accepted,
                    EffectiveSourceType: ResearchSourceType.OfficialDocumentation,
                    IsCanonicalProjectWebsite: false,
                    AssessmentNote: "trusted")
            });
    }

    private static TokenInspection CreateInspectionForMint(string mint)
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);
        return inspection with
        {
            Identity = inspection.Identity with
            {
                Mint = mint,
                Name = "SKR",
                Symbol = "SKR"
            }
        };
    }

    private static SafeSourceFetchResult SuccessFetch(string url, string contentType, string content)
    {
        return new SafeSourceFetchResult(
            Success: true,
            FinalUri: new Uri(url),
            NormalizedHost: new Uri(url).Host,
            ContentType: contentType,
            Content: content,
            BytesRead: content.Length,
            Reason: ResearchSourceAssessmentReason.None,
            Detail: null);
    }

    private static TokenResearchOrchestrator CreateOrchestratorWithProductionAssessor(
        FakeProvider provider,
        FakeRepository repository,
        Func<CandidateResearchSource, SafeSourceFetchResult> fetchHandler)
    {
        var options = Options.Create(new TokenResearchOptions
        {
            FreshnessHours = 24,
            LargestUnknownTokenAccountThresholdPercent = 10m,
            MaxSources = 16,
            MaxClaims = 32,
            MaxStatementLength = 600,
            MaxUrlLength = 2048,
            MaxTitleLength = 160,
            MaxPublisherLength = 120,
            ProviderTimeoutSeconds = 8,
            AcceptCanonicalProjectWebsite = true
        });

        var trustAssessor = new ProductionResearchTrustAssessor(
            new StubSafeResearchSourceClient(fetchHandler),
            new TrustedMintSourceRegistry(),
            new ResearchContentNormalizer(),
            new SolanaMintEvidenceMatcher(),
            new TrustedSourceClassifier(),
            NullLogger<ProductionResearchTrustAssessor>.Instance);

        return new TokenResearchOrchestrator(
            provider,
            trustAssessor,
            repository,
            new ResearchNeedDetector(options.Value),
            new ResearchRequestFactory(),
            new CandidateResearchPromoter(options.Value),
            new DeterministicResearchVerifier(),
            new ProtocolResearchContextMerger(),
            TimeProvider.System,
            options,
            NullLogger<TokenResearchOrchestrator>.Instance);
    }

    private static CachedTokenResearchSnapshot CreateSnapshot(DateTimeOffset expiresAtUtc)
    {
        var context = new ProtocolResearchContext(
            Protocol: "example",
            Sources: new[] { new ResearchSource("src", ResearchSourceType.OfficialDocumentation, "Docs", "Org", "https://example.com/docs", null, null) },
            Claims: new[]
            {
                new DocumentedClaim(
                    Id: ResearchClaimIds.DocumentedInflationaryIssuance,
                    Category: "issuance",
                    Statement: "Ongoing issuance is documented.",
                    VerificationStatus: ResearchClaimVerificationStatus.Documented,
                    VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                    SourceIds: new[] { "src" },
                    ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                    VerificationNote: null,
                    Consistency: ObservedConsistency.Unknown)
            });

        return new CachedTokenResearchSnapshot(
            Id: "id",
            Mint: "ResearchMint1111111111111111111111111111111",
            Protocol: "example",
            ResearchVersion: TokenResearchVersion.Current,
            ResearchedAtUtc: DateTimeOffset.UtcNow,
            CachedAtUtc: DateTimeOffset.UtcNow,
            ExpiresAtUtc: expiresAtUtc,
            Context: context);
    }

    private sealed class FakeProvider : ITokenResearchProvider
    {
        private readonly CandidateResearchResult _result;

        public FakeProvider(CandidateResearchResult result)
        {
            _result = result;
        }

        public int CallCount { get; private set; }

        public bool ThrowOnResearch { get; set; }

        public bool ThrowOperationCanceled { get; set; }

        public Task<ResearchProviderResult> ResearchAsync(ResearchRequest request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            CallCount++;

            if (ThrowOperationCanceled)
            {
                throw new OperationCanceledException("provider timeout simulated");
            }

            if (ThrowOnResearch)
            {
                throw new InvalidOperationException("research provider failure");
            }

            return Task.FromResult(new ResearchProviderResult(
                ResearchExecutionStatus.Complete,
                _result,
                null,
                null,
                null));
        }
    }

    private sealed class FakeTrustAssessor : IResearchTrustAssessor
    {
        private readonly ResearchTrustAssessment _assessment;

        public FakeTrustAssessor(ResearchTrustAssessment assessment)
        {
            _assessment = assessment;
        }

        public Task<ResearchTrustAssessment> AssessAsync(
            ResearchRequest request,
            CandidateResearchResult candidate,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(_assessment);
        }
    }

    private sealed class FakeRepository : ITokenResearchRepository
    {
        public CachedTokenResearchSnapshot? FreshSnapshot { get; set; }

        public bool ThrowOnReadIfCancelled { get; set; }

        public bool ThrowOnFreshRead { get; set; }

        public bool ThrowOnInsert { get; set; }

        public int GetLatestFreshCallCount { get; private set; }

        public int? LastFreshLookupResearchVersion { get; private set; }

        public int InsertCount { get; private set; }

        public List<CachedTokenResearchSnapshot> Inserted { get; } = new();

        public Task<CachedTokenResearchSnapshot?> GetLatestFreshAsync(string mint, int researchVersion, DateTimeOffset nowUtc, CancellationToken cancellationToken)
        {
            GetLatestFreshCallCount++;
            LastFreshLookupResearchVersion = researchVersion;

            if (ThrowOnReadIfCancelled)
            {
                cancellationToken.ThrowIfCancellationRequested();
            }

            if (ThrowOnFreshRead)
            {
                throw new InvalidOperationException("cache unavailable");
            }

            return Task.FromResult(FreshSnapshot);
        }

        public Task<CachedTokenResearchSnapshot?> GetLatestByMintAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult<CachedTokenResearchSnapshot?>(null);
        }

        public Task InsertAsync(CachedTokenResearchSnapshot snapshot, CancellationToken cancellationToken)
        {
            InsertCount++;

            if (ThrowOnInsert)
            {
                throw new InvalidOperationException("cache write failed");
            }

            Inserted.Add(snapshot);
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingTrustAssessor : IResearchTrustAssessor
    {
        public Task<ResearchTrustAssessment> AssessAsync(
            ResearchRequest request,
            CandidateResearchResult candidate,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new InvalidOperationException("trust assessor failure");
        }
    }
}
