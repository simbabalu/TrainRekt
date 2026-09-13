using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class ProductionResearchTrustAssessorTests
{
    [Fact]
    public async Task AssessAsync_RegisteredCanonicalDomainWithExactMint_IsConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", ProtocolConstants.SolanaMobileSkrMint));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://docs.solanamobile.com/solana-mobile-stack/skr", claimedType: ResearchSourceType.ThirdParty);

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
        Assert.Equal(ResearchSourceAssessmentDecision.Accepted, assessment.Sources[0].Decision);
    }

    [Fact]
    public async Task AssessAsync_RegisteredCanonicalDomainWithoutMint_IsNotConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", "no mint"));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://docs.solanamobile.com/solana-mobile-stack/skr");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.NotEqual(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
    }

    [Fact]
    public async Task AssessAsync_RegisteredSkrWebsitePathWithExactMint_IsConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", ProtocolConstants.SolanaMobileSkrMint));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://solanamobile.com/skr");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
        Assert.Equal(ResearchSourceAssessmentDecision.Accepted, assessment.Sources[0].Decision);
        Assert.Equal(ResearchSourceType.ProjectWebsite, assessment.Sources[0].EffectiveSourceType);
    }

    [Fact]
    public async Task AssessAsync_RegisteredSkrWebsitePathWithoutMint_IsNotConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", "no mint"));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://solanamobile.com/skr");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.NotEqual(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
        Assert.Equal(ResearchSourceAssessmentDecision.Rejected, assessment.Sources[0].Decision);
        Assert.Equal(ResearchSourceAssessmentReason.MintNotReferenced, assessment.Sources[0].Reason);
    }

    [Fact]
    public async Task AssessAsync_UnregisteredDomainWithExactMint_IsPartial()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", ProtocolConstants.SolanaMobileSkrMint));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://untrusted.example/skr");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Partial, assessment.Identity.Match);
        Assert.Equal(ResearchSourceAssessmentReason.SourceIdentityUnconfirmed, assessment.Sources[0].Reason);
    }

    [Fact]
    public async Task AssessAsync_ProviderClaimedCanonical_IsIgnored()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", ProtocolConstants.SolanaMobileSkrMint));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://untrusted.example/skr", claimedCanonical: true);

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Partial, assessment.Identity.Match);
    }

    [Fact]
    public async Task AssessAsync_ProviderClaimedOfficialDocumentation_IsIgnored()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", ProtocolConstants.SolanaMobileSkrMint));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://untrusted.example/skr", claimedType: ResearchSourceType.OfficialDocumentation);

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Partial, assessment.Identity.Match);
        Assert.Equal(ResearchSourceAssessmentDecision.Rejected, assessment.Sources[0].Decision);
    }

    [Fact]
    public async Task AssessAsync_RegisteredRepoWithExactMint_IsConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", ProtocolConstants.SolanaMobileSkrMint));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://github.com/solana-mobile/react-native-samples/blob/main/skr-staking/README.md");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
    }

    [Fact]
    public async Task AssessAsync_UnregisteredRepoWithExactMint_IsNotConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", ProtocolConstants.SolanaMobileSkrMint));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://github.com/spoof/repo/blob/main/readme.md");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.NotEqual(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
    }

    [Fact]
    public async Task AssessAsync_RawGithubMappingForRegisteredRepo_IsConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "application/json", "{\"mint\":\"SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3\"}"));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://raw.githubusercontent.com/solana-mobile/react-native-samples/main/skr-staking/program/idl.json");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
    }

    [Fact]
    public async Task AssessAsync_SymbolOnlyEvidence_IsNotConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", "SKR token"));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://docs.solanamobile.com/solana-mobile-stack/skr");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.NotEqual(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
    }

    [Fact]
    public async Task AssessAsync_NameOnlyEvidence_IsNotConfirmed()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", "Solana Mobile SKR"));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://docs.solanamobile.com/solana-mobile-stack/skr");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.NotEqual(ResearchIdentityMatch.Confirmed, assessment.Identity.Match);
    }

    [Fact]
    public async Task AssessAsync_ConflictingTrustedMintEvidence_IsConflict()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "application/json", "{\"mint\":\"So11111111111111111111111111111111111111112\"}"));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://raw.githubusercontent.com/solana-mobile/react-native-samples/main/skr-staking/program/idl.json");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Conflict, assessment.Identity.Match);
        Assert.Equal(ResearchSourceAssessmentReason.ConflictingMint, assessment.Sources[0].Reason);
    }

    [Fact]
    public async Task AssessAsync_MalformedJson_IsRejectedWithTypedReason()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "application/json", "{bad json"));
        var request = CreateRequest(ProtocolConstants.SolanaMobileSkrMint);
        var candidate = Candidate("https://docs.solanamobile.com/solana-mobile-stack/skr");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchSourceAssessmentReason.MalformedContent, assessment.Sources[0].Reason);
        Assert.Equal(ResearchIdentityMatch.Unconfirmed, assessment.Identity.Match);
    }

    [Fact]
    public async Task AssessAsync_InvalidRequestedMint_IsRejected()
    {
        var assessor = CreateAssessor(source => SuccessFetch(source.Url, "text/plain", ProtocolConstants.SolanaMobileSkrMint));
        var request = CreateRequest("invalid-mint");
        var candidate = Candidate("https://docs.solanamobile.com/solana-mobile-stack/skr");

        var assessment = await assessor.AssessAsync(request, candidate, CancellationToken.None);

        Assert.Equal(ResearchIdentityMatch.Unconfirmed, assessment.Identity.Match);
        Assert.Equal(ResearchSourceAssessmentReason.InvalidUrl, assessment.Sources[0].Reason);
    }

    private static ProductionResearchTrustAssessor CreateAssessor(Func<CandidateResearchSource, SafeSourceFetchResult> fetchHandler)
    {
        return new ProductionResearchTrustAssessor(
            new StubSafeResearchSourceClient(fetchHandler),
            new TrustedMintSourceRegistry(),
            new ResearchContentNormalizer(),
            new SolanaMintEvidenceMatcher(),
            new TrustedSourceClassifier(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<ProductionResearchTrustAssessor>.Instance);
    }

    private static ResearchRequest CreateRequest(string mint)
    {
        return new ResearchRequest(
            Mint: mint,
            TokenName: "SKR",
            TokenSymbol: "SKR",
            TokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            Authorities: new TokenAuthorities("auth", false, null, true),
            ClassifiedProtocols: new[] { ProtocolConstants.SolanaMobileSkrProtocolName },
            Needs: Array.Empty<ResearchNeed>(),
            ExistingSourceIds: Array.Empty<string>(),
            ExistingClaimIds: Array.Empty<string>());
    }

    private static CandidateResearchResult Candidate(string url, ResearchSourceType claimedType = ResearchSourceType.ThirdParty, bool claimedCanonical = false)
    {
        return new CandidateResearchResult(
            IdentityEvidence: new[]
            {
                new CandidateIdentityEvidence(ResearchIdentityEvidenceType.SymbolOrNameMatch, "SKR", "provider claim")
            },
            Sources: new[]
            {
                new CandidateResearchSource(
                    Id: "src",
                    ClaimedSourceType: claimedType,
                    Title: "title",
                    Publisher: "publisher",
                    Url: url,
                    ClaimedCanonicalProjectWebsite: claimedCanonical,
                    PublishedAtUtc: null)
            },
            Claims: new[]
            {
                new CandidateDocumentedClaim(
                    Id: ResearchClaimIds.DocumentedInflationaryIssuance,
                    Category: "issuance",
                    Statement: "statement",
                    SourceIds: new[] { "src" },
                    ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                    ExtractionNote: null)
            });
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
}
