using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TrustedIdentityProvenanceServiceTests
{
    private const string ScannedMint = ProtocolConstants.SolanaMobileSkrMint;
    private const string CompetitorMint = "So11111111111111111111111111111111111111112";
    private const string JupiterMint = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

    [Fact]
    public async Task AnalyzeAsync_NoSourceAvailable_ReturnsUnknowns()
    {
        var safeClient = new StubSafeResearchSourceClient();
        var cache = new StubSourceVerificationCache();
        var service = CreateService(safeClient, cache);

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: null,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Empty(result.Sources);
        Assert.Contains(TrustedIdentityProvenanceUnknown.NoIdentitySourceAvailable, result.Unknowns);
        Assert.Contains(TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable, result.Unknowns);
        Assert.Contains(TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_MetadataSourceDiscovered_ReferencesScannedMint()
    {
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess("https://project.example/metadata.json", $"mint {CompetitorMint}");

        var service = CreateService(safeClient, new StubSourceVerificationCache(), options: new TrustedIdentityProvenanceOptions
        {
            MaxSources = 1,
            MaxCompetingMints = 1,
            MaxEvidencePerSource = 8,
            MaxTotalEvidence = 24,
            SourceTimeoutSeconds = 8,
            TrustedFreshnessHours = 24,
            ClaimedFreshnessHours = 6,
            UnavailableFreshnessMinutes = 10,
            ConflictFreshnessMinutes = 60,
            MaxBase58CandidatesPerSource = 256
        });

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(IdentitySourceTrust.ClaimedProjectSource, result.Sources[0].SourceTrust);
        Assert.Equal(IdentityMintLinkStatus.ReferencesScannedMint, result.Sources[0].MintLinkStatus);
        Assert.Contains(result.Evidence, entry => entry.Id == "SOURCE_DISCOVERED_FROM_TOKEN_METADATA");
        Assert.Contains(result.Evidence, entry => entry.Id == "SOURCE_REFERENCES_SCANNED_MINT");
    }

    [Fact]
    public async Task AnalyzeAsync_TrustedRegistrySource_ProducesTrustedScannedEvidence()
    {
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess("https://docs.solanamobile.com/solana-mobile-stack/skr", $"mint {ScannedMint}");

        var options = DefaultOptions();
        options.MaxSources = 1;
        var service = CreateService(safeClient, new StubSourceVerificationCache(), options);

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: ScannedMint,
                ScannedMetadataUri: null,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(IdentitySourceTrust.Trusted, result.Sources[0].SourceTrust);
        Assert.Equal(IdentityMintLinkStatus.ReferencesScannedMint, result.Sources[0].MintLinkStatus);
        Assert.Contains(result.Evidence, entry => entry.Id == "SOURCE_MATCHES_TRUST_REGISTRY");
        Assert.Contains(result.Evidence, entry => entry.Id == "TRUSTED_SOURCE_REFERENCES_SCANNED_MINT");
        Assert.DoesNotContain(TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_JupiterMetadataDeterministicallyResolvesProjectPolicy_AndCanProduceExactMintMatch()
    {
        var metadataUri = "https://station.jup.ag/guides/token-list";
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess(metadataUri, $"mint {JupiterMint}");

        var options = DefaultOptions();
        options.MaxSources = 1;
        var result = await CreateService(safeClient, new StubSourceVerificationCache(), options).AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: JupiterMint,
                ScannedMetadataUri: metadataUri,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(IdentitySourceTrust.Trusted, result.Sources[0].SourceTrust);
        Assert.Equal(IdentityMintLinkStatus.ReferencesScannedMint, result.Sources[0].MintLinkStatus);
    }

    [Fact]
    public async Task AnalyzeAsync_JupiterTrustedSourceWithoutInspectedMint_ProducesNoRelevantMintReference()
    {
        var metadataUri = "https://station.jup.ag/guides/token-list";
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess(metadataUri, "no relevant mint present");

        var options = DefaultOptions();
        options.MaxSources = 1;
        var result = await CreateService(safeClient, new StubSourceVerificationCache(), options).AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: JupiterMint,
                ScannedMetadataUri: metadataUri,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(IdentitySourceTrust.Trusted, result.Sources[0].SourceTrust);
        Assert.Equal(IdentityMintLinkStatus.NoRelevantMintReference, result.Sources[0].MintLinkStatus);
    }

    [Fact]
    public async Task AnalyzeAsync_JupiterFetchFailure_ProducesFetchUnavailable()
    {
        var metadataUri = "https://station.jup.ag/guides/token-list";
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddFailure(metadataUri, ResearchSourceAssessmentReason.Timeout);

        var options = DefaultOptions();
        options.MaxSources = 1;
        var result = await CreateService(safeClient, new StubSourceVerificationCache(), options).AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: JupiterMint,
                ScannedMetadataUri: metadataUri,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(IdentityMintLinkStatus.FetchUnavailable, result.Sources[0].MintLinkStatus);
        Assert.Contains(TrustedIdentityProvenanceUnknown.SourceFetchPartial, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_LookalikeJupiterDomain_IsNeverTrusted()
    {
        var metadataUri = "https://jup.ag.evil.example/token";
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess(metadataUri, $"mint {JupiterMint}");

        var options = DefaultOptions();
        options.MaxSources = 1;
        var result = await CreateService(safeClient, new StubSourceVerificationCache(), options).AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: JupiterMint,
                ScannedMetadataUri: metadataUri,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.NotEqual(IdentitySourceTrust.Trusted, result.Sources[0].SourceTrust);
        Assert.Equal(IdentityMintLinkStatus.ReferencesScannedMint, result.Sources[0].MintLinkStatus);
    }

    [Fact]
    public async Task AnalyzeAsync_ArbitraryGithubRepositoryWithJupMint_IsNeverTrusted()
    {
        var metadataUri = "https://github.com/not-jup-org/fake-repo/blob/main/README.md";
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess(metadataUri, $"mint {JupiterMint}");

        var options = DefaultOptions();
        options.MaxSources = 1;
        var result = await CreateService(safeClient, new StubSourceVerificationCache(), options).AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: JupiterMint,
                ScannedMetadataUri: metadataUri,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.NotEqual(IdentitySourceTrust.Trusted, result.Sources[0].SourceTrust);
    }

    [Fact]
    public async Task AnalyzeAsync_UnknownProjectMetadata_FailsClosedWithoutTrustedSources()
    {
        var metadataUri = "https://unknown.example/token";
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess(metadataUri, $"mint {JupiterMint}");

        var options = DefaultOptions();
        options.MaxSources = 1;
        var result = await CreateService(safeClient, new StubSourceVerificationCache(), options).AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: JupiterMint,
                ScannedMetadataUri: metadataUri,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.NotEqual(IdentitySourceTrust.Trusted, result.Sources[0].SourceTrust);
        Assert.Contains(TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_JupiterTrustedConflictingMintEvidence_RecordsConflict()
    {
        var metadataUri = "https://station.jup.ag/guides/token-list";
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess(metadataUri, $"mint {CompetitorMint}");

        var options = DefaultOptions();
        options.MaxSources = 1;
        var result = await CreateService(safeClient, new StubSourceVerificationCache(), options).AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: JupiterMint,
                ScannedMetadataUri: metadataUri,
                Collisions: new[]
                {
                    CreateCollision(CompetitorMint, TokenIdentityMatchLevel.Exact, true, true, DateTimeOffset.UtcNow.AddMinutes(-10))
                },
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(IdentitySourceTrust.Trusted, result.Sources[0].SourceTrust);
        Assert.Equal(IdentityMintLinkStatus.ReferencesCompetingMint, result.Sources[0].MintLinkStatus);
        Assert.Contains(result.Conflicts, conflict => conflict.Id == "TRUSTED_SOURCE_REFERENCES_COMPETING_MINT");
        Assert.Contains(TrustedIdentityProvenanceUnknown.IdentitySourceConflict, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_JupiterProjectPolicyWithTwoIndependentTrustedSources_ProducesTwoExactMatches()
    {
        var metadataUri = "https://station.jup.ag/guides/token-list";
        var trustedDocs = "https://docs.jup.ag/";
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess(metadataUri, $"mint {JupiterMint}");
        safeClient.AddSuccess(trustedDocs, $"mint {JupiterMint}");

        var options = DefaultOptions();
        options.MaxSources = 2;
        var result = await CreateService(safeClient, new StubSourceVerificationCache(), options).AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: JupiterMint,
                ScannedMetadataUri: metadataUri,
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Equal(2, result.Sources.Count(source =>
            source.SourceTrust == IdentitySourceTrust.Trusted
            && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesScannedMint));
        Assert.DoesNotContain(TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_TrustedSourceReferencingCompetingMint_RecordsConflict()
    {
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess("https://docs.solanamobile.com/solana-mobile-stack/skr", $"mint {CompetitorMint}");

        var options = DefaultOptions();
        options.MaxSources = 1;
        var service = CreateService(safeClient, new StubSourceVerificationCache(), options);

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: ScannedMint,
                ScannedMetadataUri: null,
                Collisions: new[]
                {
                    CreateCollision(CompetitorMint, TokenIdentityMatchLevel.Exact, true, true, DateTimeOffset.UtcNow.AddMinutes(-10))
                },
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Conflicts);
        Assert.Contains(result.Conflicts, entry => entry.Id == "TRUSTED_SOURCE_REFERENCES_COMPETING_MINT");
        Assert.Contains(TrustedIdentityProvenanceUnknown.IdentitySourceConflict, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_MetadataNonHttps_IsRejectedAsFetchUnavailable()
    {
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddFailure("http://project.example/source", ResearchSourceAssessmentReason.UnsupportedScheme);
        var service = CreateService(safeClient, new StubSourceVerificationCache());

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "http://project.example/source",
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(IdentityMintLinkStatus.FetchUnavailable, result.Sources[0].MintLinkStatus);
        Assert.Contains(result.Evidence, entry => entry.Id == "SOURCE_FETCH_UNAVAILABLE");
        Assert.Contains(TrustedIdentityProvenanceUnknown.SourceFetchPartial, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_FreshCache_SkipsFetch()
    {
        var safeClient = new StubSafeResearchSourceClient();
        var cache = new StubSourceVerificationCache
        {
            NextGet = CreateCachedSnapshot(
                "https://project.example/metadata.json",
                "fingerprint",
                IdentitySourceTrust.ClaimedProjectSource,
                IdentityMintLinkStatus.ReferencesScannedMint,
                DateTimeOffset.UtcNow.AddHours(1))
        };

        var service = CreateService(safeClient, cache);

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(0, safeClient.CallCount);
    }

    [Fact]
    public async Task AnalyzeAsync_ExpiredCache_FetchesSource()
    {
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess("https://project.example/metadata.json", $"mint {CompetitorMint}");
        var cache = new StubSourceVerificationCache();
        var service = CreateService(safeClient, cache);

        _ = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Equal(1, safeClient.CallCount);
        Assert.Equal(1, cache.InsertCount);
    }

    [Fact]
    public async Task AnalyzeAsync_CacheReadFailure_PreventsFetchStorm()
    {
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess("https://project.example/metadata.json", $"mint {CompetitorMint}");
        var cache = new StubSourceVerificationCache { ThrowOnGet = true };
        var service = CreateService(safeClient, cache);

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Equal(0, safeClient.CallCount);
        Assert.Empty(result.Sources);
        Assert.Contains(TrustedIdentityProvenanceUnknown.SourceFetchPartial, result.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_CacheWriteFailure_ReturnsCurrentEvidence()
    {
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess("https://project.example/metadata.json", $"mint {CompetitorMint}");
        var cache = new StubSourceVerificationCache { ThrowOnInsert = true };
        var service = CreateService(safeClient, cache);

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.Equal(1, safeClient.CallCount);
    }

    [Fact]
    public async Task AnalyzeAsync_CallerCancellation_Propagates()
    {
        var safeClient = new StubSafeResearchSourceClient { ThrowCancellation = true };
        var service = CreateService(safeClient, new StubSourceVerificationCache());
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            cts.Token));
    }

    [Fact]
    public async Task AnalyzeAsync_CompetingMintPrioritization_IsBounded()
    {
        var safeClient = new StubSafeResearchSourceClient();
        var allCompetitors = new[]
        {
            "11111111111111111111111111111111",
            "So11111111111111111111111111111111111111112",
            "So11111111111111111111111111111111111111113",
            "So11111111111111111111111111111111111111114",
            "So11111111111111111111111111111111111111115",
            "So11111111111111111111111111111111111111116"
        };

        safeClient.AddSuccess(
            "https://project.example/metadata.json",
            string.Join(' ', allCompetitors));

        var options = DefaultOptions();
        options.MaxCompetingMints = 3;
        var service = CreateService(safeClient, new StubSourceVerificationCache(), options);

        var collisions = new[]
        {
            CreateCollision(allCompetitors[0], TokenIdentityMatchLevel.Exact, true, true, DateTimeOffset.UtcNow.AddMinutes(-20)),
            CreateCollision(allCompetitors[1], TokenIdentityMatchLevel.Exact, true, false, DateTimeOffset.UtcNow.AddMinutes(-19)),
            CreateCollision(allCompetitors[2], TokenIdentityMatchLevel.Exact, false, true, DateTimeOffset.UtcNow.AddMinutes(-18)),
            CreateCollision(allCompetitors[3], TokenIdentityMatchLevel.NormalizedExact, true, true, DateTimeOffset.UtcNow.AddMinutes(-17)),
            CreateCollision(allCompetitors[4], TokenIdentityMatchLevel.NormalizedExact, true, true, DateTimeOffset.UtcNow.AddMinutes(-16)),
            CreateCollision(allCompetitors[5], TokenIdentityMatchLevel.NormalizedExact, true, true, DateTimeOffset.UtcNow.AddMinutes(-15))
        };

        var result = await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: collisions,
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.Single(result.Sources);
        Assert.True(result.Sources[0].ReferencedRelevantMints.Count <= 4);
    }

    [Fact]
    public async Task AnalyzeAsync_RelevantMintSetFingerprint_ChangesWithCollisionSet()
    {
        var safeClient = new StubSafeResearchSourceClient();
        safeClient.AddSuccess("https://project.example/metadata.json", $"mint {CompetitorMint}");
        var cache = new StubSourceVerificationCache();
        var service = CreateService(safeClient, cache);

        await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: Array.Empty<TokenIdentityCollision>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        var first = cache.LastRequestedFingerprint;

        await service.AnalyzeAsync(
            new TrustedIdentityProvenanceRequest(
                ScannedMint: CompetitorMint,
                ScannedMetadataUri: "https://project.example/metadata.json",
                Collisions: new[]
                {
                    CreateCollision(ScannedMint, TokenIdentityMatchLevel.Exact, true, true, DateTimeOffset.UtcNow.AddMinutes(-5))
                },
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CancellationToken.None);

        Assert.NotEqual(first, cache.LastRequestedFingerprint);
        Assert.Equal(1, cache.LastRequestedVersion);
    }

    private static TrustedIdentityProvenanceService CreateService(
        StubSafeResearchSourceClient safeClient,
        StubSourceVerificationCache cache,
        TrustedIdentityProvenanceOptions? options = null)
    {
        options ??= DefaultOptions();
        var mintRegistry = new TrustedMintSourceRegistry();
        var projectPolicyRegistry = new TrustedProjectSourcePolicyRegistry();

        return new TrustedIdentityProvenanceService(
            new IdentitySourceCandidateExtractor(mintRegistry),
            new DeterministicTrustedProjectPolicyResolver(projectPolicyRegistry, mintRegistry),
            safeClient,
            cache,
            mintRegistry,
            new TrustedSourceClassifier(),
            new ResearchContentNormalizer(),
            new SolanaMintEvidenceMatcher(),
            Options.Create(options),
            TimeProvider.System,
            NullLogger<TrustedIdentityProvenanceService>.Instance);
    }

    private static TrustedIdentityProvenanceOptions DefaultOptions()
    {
        return new TrustedIdentityProvenanceOptions
        {
            MaxSources = 6,
            MaxCompetingMints = 5,
            MaxEvidencePerSource = 8,
            MaxTotalEvidence = 24,
            SourceTimeoutSeconds = 8,
            TrustedFreshnessHours = 24,
            ClaimedFreshnessHours = 6,
            UnavailableFreshnessMinutes = 10,
            ConflictFreshnessMinutes = 60,
            MaxBase58CandidatesPerSource = 256
        };
    }

    private static TokenIdentityCollision CreateCollision(
        string mint,
        TokenIdentityMatchLevel level,
        bool includeName,
        bool includeSymbol,
        DateTimeOffset firstObservedAtUtc)
    {
        var dimensions = new List<TokenIdentityMatchDimension>();
        if (includeName)
        {
            dimensions.Add(TokenIdentityMatchDimension.Name);
        }

        if (includeSymbol)
        {
            dimensions.Add(TokenIdentityMatchDimension.Symbol);
        }

        return new TokenIdentityCollision(
            CandidateMint: mint,
            RawName: "name",
            RawSymbol: "sym",
            MatchDimensions: dimensions,
            MatchLevel: level,
            FirstObservedAtUtc: firstObservedAtUtc,
            LastObservedAtUtc: firstObservedAtUtc.AddMinutes(1));
    }

    private static CachedTokenIdentitySourceVerificationSnapshot CreateCachedSnapshot(
        string canonicalUrl,
        string fingerprint,
        IdentitySourceTrust trust,
        IdentityMintLinkStatus status,
        DateTimeOffset expiresAtUtc)
    {
        return new CachedTokenIdentitySourceVerificationSnapshot(
            Id: "cached-1",
            CanonicalUrl: canonicalUrl,
            RelevantMintSetFingerprint: fingerprint,
            IdentityProvenanceVersion: 1,
            AnalyzedAtUtc: DateTimeOffset.UtcNow,
            CachedAtUtc: DateTimeOffset.UtcNow,
            ExpiresAtUtc: expiresAtUtc,
            SourceEvidence: new IdentitySourceEvidence(
                Url: canonicalUrl,
                Publisher: "cached",
                SourceTrust: trust,
                MintLinkStatus: status,
                ReferencedRelevantMints: status == IdentityMintLinkStatus.ReferencesScannedMint ? new[] { CompetitorMint } : Array.Empty<string>(),
                EvidenceSummary: "cached"),
            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>());
    }

    private sealed class StubSafeResearchSourceClient : ISafeResearchSourceClient
    {
        private readonly Dictionary<string, SafeSourceFetchResult> _results = new(StringComparer.Ordinal);

        public int CallCount { get; private set; }

        public bool ThrowCancellation { get; set; }

        public void AddSuccess(string url, string content)
        {
            _results[url] = new SafeSourceFetchResult(
                Success: true,
                FinalUri: new Uri(url),
                NormalizedHost: new Uri(url).Host,
                ContentType: "text/plain",
                Content: content,
                BytesRead: content.Length,
                Reason: ResearchSourceAssessmentReason.None,
                Detail: null);
        }

        public void AddFailure(string url, ResearchSourceAssessmentReason reason)
        {
            _results[url] = new SafeSourceFetchResult(
                Success: false,
                FinalUri: null,
                NormalizedHost: null,
                ContentType: null,
                Content: null,
                BytesRead: 0,
                Reason: reason,
                Detail: "failed");
        }

        public Task<SafeSourceFetchResult> FetchAsync(CandidateResearchSource candidateSource, CancellationToken cancellationToken)
        {
            if (ThrowCancellation && cancellationToken.IsCancellationRequested)
            {
                cancellationToken.ThrowIfCancellationRequested();
            }

            CallCount += 1;
            if (_results.TryGetValue(candidateSource.Url, out var result))
            {
                return Task.FromResult(result);
            }

            return Task.FromResult(new SafeSourceFetchResult(
                Success: false,
                FinalUri: null,
                NormalizedHost: null,
                ContentType: null,
                Content: null,
                BytesRead: 0,
                Reason: ResearchSourceAssessmentReason.HttpNotSuccessful,
                Detail: "missing"));
        }
    }

    private sealed class StubSourceVerificationCache : ITokenIdentitySourceVerificationSnapshotRepository
    {
        public CachedTokenIdentitySourceVerificationSnapshot? NextGet { get; set; }

        public bool ThrowOnGet { get; set; }

        public bool ThrowOnInsert { get; set; }

        public int InsertCount { get; private set; }

        public string LastRequestedFingerprint { get; private set; } = string.Empty;

        public int LastRequestedVersion { get; private set; }

        public Task<CachedTokenIdentitySourceVerificationSnapshot?> GetFreshAsync(
            string canonicalUrl,
            string relevantMintSetFingerprint,
            int identityProvenanceVersion,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken)
        {
            if (ThrowOnGet)
            {
                throw new InvalidOperationException("cache read failed");
            }

            LastRequestedFingerprint = relevantMintSetFingerprint;
            LastRequestedVersion = identityProvenanceVersion;

            return Task.FromResult(NextGet);
        }

        public Task InsertAsync(CachedTokenIdentitySourceVerificationSnapshot snapshot, CancellationToken cancellationToken)
        {
            if (ThrowOnInsert)
            {
                throw new InvalidOperationException("cache write failed");
            }

            InsertCount += 1;
            return Task.CompletedTask;
        }
    }
}
