using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class CandidateResearchPromoterTests
{
    private readonly TokenResearchOptions _options = new();

    [Fact]
    public void Promote_ProviderDeclaredConfirmedByItself_DoesNotPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate();
        var trust = CreateFailClosedAssessment();

        var result = promoter.Promote(CreateRequest(), candidate, trust);

        Assert.True(result.IsValid);
        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_ProviderDeclaredOfficialDocumentationByItself_DoesNotPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate(sourceType: ResearchSourceType.OfficialDocumentation);

        var result = promoter.Promote(CreateRequest(), candidate, CreateFailClosedAssessment());

        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_ProviderDeclaredOfficialWhitepaperByItself_DoesNotPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate(sourceType: ResearchSourceType.OfficialWhitepaper);

        var result = promoter.Promote(CreateRequest(), candidate, CreateFailClosedAssessment());

        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_ProviderDeclaredCanonicalProjectWebsiteByItself_DoesNotPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate(sourceType: ResearchSourceType.ProjectWebsite, canonicalProjectWebsite: true);

        var result = promoter.Promote(CreateRequest(), candidate, CreateFailClosedAssessment());

        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_SymbolNameOnlyIdentityEvidence_CannotBecomeConfirmedWithoutTrustedAssessment()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = new CandidateResearchResult(
            IdentityEvidence: new[]
            {
                new CandidateIdentityEvidence(ResearchIdentityEvidenceType.SymbolOrNameMatch, "RCH", "symbol only")
            },
            Sources: new[] { CreateSource("src") },
            Claims: new[] { CreateClaim("src", ResearchClaimIds.DocumentedInflationaryIssuance) });

        var result = promoter.Promote(CreateRequest(), candidate, CreateFailClosedAssessment());

        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_ExactMintClaimWithoutTrustedSourceAssessment_DoesNotPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate();
        var trust = new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Confirmed, true, new[] { "mint match" }),
            Sources: Array.Empty<AssessedResearchSource>());

        var result = promoter.Promote(CreateRequest(), candidate, trust);

        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_TrustedFakeAssessmentWithExactMint_MayPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate();
        var trust = new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Confirmed, true, new[] { "trusted exact mint evidence" }),
            Sources: new[]
            {
                new AssessedResearchSource(
                    CandidateSourceId: "src",
                    Decision: ResearchSourceAssessmentDecision.Accepted,
                    EffectiveSourceType: ResearchSourceType.OfficialDocumentation,
                    IsCanonicalProjectWebsite: false,
                    AssessmentNote: "trusted mapping")
            });

        var result = promoter.Promote(CreateRequest(), candidate, trust);

        Assert.True(result.IsValid);
        Assert.True(result.HasUsableContent);
        Assert.NotNull(result.Context);
    }

    [Fact]
    public void Promote_TrustedOfficialSourceAssessment_MayPromoteValidClaim()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate();
        var trust = new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Confirmed, true, new[] { "trusted exact mint evidence" }),
            Sources: new[]
            {
                new AssessedResearchSource(
                    CandidateSourceId: "src",
                    Decision: ResearchSourceAssessmentDecision.Accepted,
                    EffectiveSourceType: ResearchSourceType.OfficialRepository,
                    IsCanonicalProjectWebsite: false,
                    AssessmentNote: "trusted official source")
            });

        var result = promoter.Promote(CreateRequest(), candidate, trust);

        Assert.True(result.HasUsableContent);
        Assert.Equal(ResearchSourceType.OfficialRepository, result.Context!.Sources[0].SourceType);
    }

    [Fact]
    public void Promote_PartialIdentity_DoesNotPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var result = promoter.Promote(CreateRequest(), CreateValidCandidate(), CreateTrustWithIdentity(ResearchIdentityMatch.Partial, true));
        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_UnconfirmedIdentity_DoesNotPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var result = promoter.Promote(CreateRequest(), CreateValidCandidate(), CreateTrustWithIdentity(ResearchIdentityMatch.Unconfirmed, true));
        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_ConflictIdentity_DoesNotPromote()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var result = promoter.Promote(CreateRequest(), CreateValidCandidate(), CreateTrustWithIdentity(ResearchIdentityMatch.Conflict, true));
        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_ThirdPartySource_DoesNotAutoPromote_WhenAssessorRejects()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate(sourceType: ResearchSourceType.ThirdParty);
        var trust = new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Confirmed, true, new[] { "trusted exact mint evidence" }),
            Sources: new[]
            {
                new AssessedResearchSource(
                    CandidateSourceId: "src",
                    Decision: ResearchSourceAssessmentDecision.Rejected,
                    EffectiveSourceType: null,
                    IsCanonicalProjectWebsite: false,
                    AssessmentNote: "third-party not trusted")
            });

        var result = promoter.Promote(CreateRequest(), candidate, trust);

        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_AbsenceOfTrustedAssessorDecision_FailsClosed()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate();
        var trust = new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Confirmed, true, new[] { "claimed" }),
            Sources: Array.Empty<AssessedResearchSource>());

        var result = promoter.Promote(CreateRequest(), candidate, trust);

        Assert.False(result.HasUsableContent);
    }

    [Fact]
    public void Promote_CandidateCannotCreateVerified()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var result = promoter.Promote(CreateRequest(), CreateValidCandidate(), CreateTrustedAssessment());

        Assert.NotNull(result.Context);
        Assert.Equal(ResearchClaimVerificationStatus.Documented, result.Context.Claims[0].VerificationStatus);
    }

    [Fact]
    public void Promote_CandidateCannotSelectDeterministicReconciliation()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var result = promoter.Promote(CreateRequest(), CreateValidCandidate(), CreateTrustedAssessment());

        Assert.NotNull(result.Context);
        Assert.Equal(ResearchClaimVerificationMethod.DocumentationOnly, result.Context.Claims[0].VerificationMethod);
    }

    [Fact]
    public void Promote_UnknownSourceReference_RejectsClaim()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate() with
        {
            Claims = new[]
            {
                new CandidateDocumentedClaim(
                    "DOCUMENTED_INFLATIONARY_ISSUANCE",
                    "issuance",
                    "Documented issuance.",
                    new[] { "missing" },
                    Array.Empty<ObservedFactReference>(),
                    null)
            }
        };

        var result = promoter.Promote(CreateRequest(), candidate, CreateTrustedAssessment());

        Assert.True(result.IsValid);
        Assert.False(result.HasUsableContent);
        Assert.Equal(1, result.ClaimsRejected);
    }

    [Fact]
    public void Promote_DuplicateSourceIds_RejectsCandidateAsInvalid()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate() with
        {
            Sources = new[]
            {
                CreateSource("src"),
                CreateSource("src")
            }
        };

        var result = promoter.Promote(CreateRequest(), candidate, CreateTrustedAssessment());

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Promote_DuplicateClaimIds_RejectsCandidateAsInvalid()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var claim = CreateClaim("src", "DOCUMENTED_INFLATIONARY_ISSUANCE");
        var candidate = CreateValidCandidate() with
        {
            Claims = new[] { claim, claim }
        };

        var result = promoter.Promote(CreateRequest(), candidate, CreateTrustedAssessment());

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Promote_NonHttpsSource_RejectsCandidateAsInvalid()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate() with
        {
            Sources = new[]
            {
                CreateSource("src") with { Url = "http://example.com/docs" }
            }
        };

        var result = promoter.Promote(CreateRequest(), candidate, CreateTrustedAssessment());

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Promote_OverlongStatement_RejectsClaim()
    {
        var options = new TokenResearchOptions { MaxStatementLength = 16 };
        var promoter = new CandidateResearchPromoter(options);
        var candidate = CreateValidCandidate() with
        {
            Claims = new[]
            {
                CreateClaim("src", "CLAIM") with { Statement = new string('x', 17) }
            }
        };

        var result = promoter.Promote(CreateRequest(), candidate, CreateTrustedAssessment());

        Assert.True(result.IsValid);
        Assert.False(result.HasUsableContent);
        Assert.Equal(1, result.ClaimsRejected);
    }

    [Fact]
    public void Promote_UnsupportedObservedFactId_IsIgnoredSafely()
    {
        var promoter = new CandidateResearchPromoter(_options);
        var candidate = CreateValidCandidate() with
        {
            Claims = new[]
            {
                new CandidateDocumentedClaim(
                    "CLAIM",
                    "issuance",
                    "Statement",
                    new[] { "src" },
                    new[]
                    {
                        new ObservedFactReference("unsupported.fact", "x", null, null)
                    },
                    null)
            }
        };

        var result = promoter.Promote(CreateRequest(), candidate, CreateTrustedAssessment());

        Assert.NotNull(result.Context);
        Assert.Empty(result.Context.Claims[0].ObservedFactReferences);
    }

    private static ResearchRequest CreateRequest()
    {
        return new ResearchRequest(
            Mint: "ResearchMint1111111111111111111111111111111",
            TokenName: "Research Token",
            TokenSymbol: "RCH",
            TokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            Authorities: new TokenAuthorities("MintAuth", false, null, true),
            ClassifiedProtocols: new[] { "example-protocol" },
            Needs: Array.Empty<ResearchNeed>(),
            ExistingSourceIds: Array.Empty<string>(),
            ExistingClaimIds: Array.Empty<string>());
    }

    private static CandidateResearchResult CreateValidCandidate(
        ResearchSourceType sourceType = ResearchSourceType.OfficialDocumentation,
        bool canonicalProjectWebsite = false)
    {
        return new CandidateResearchResult(
            IdentityEvidence: new[]
            {
                new CandidateIdentityEvidence(ResearchIdentityEvidenceType.MintAddressMentioned, "ResearchMint1111111111111111111111111111111", "Mint appears in docs")
            },
            Sources: new[] { CreateSource("src", sourceType, canonicalProjectWebsite) },
            Claims: new[] { CreateClaim("src", ResearchClaimIds.DocumentedInflationaryIssuance) });
    }

    private static CandidateResearchSource CreateSource(string id, ResearchSourceType sourceType = ResearchSourceType.OfficialDocumentation, bool canonicalProjectWebsite = false)
    {
        return new CandidateResearchSource(
            Id: id,
            ClaimedSourceType: sourceType,
            Title: "Docs",
            Publisher: "Org",
            Url: "https://example.com/docs",
            ClaimedCanonicalProjectWebsite: canonicalProjectWebsite,
            PublishedAtUtc: null);
    }

    private static CandidateDocumentedClaim CreateClaim(string sourceId, string claimId)
    {
        return new CandidateDocumentedClaim(
            Id: claimId,
            Category: "issuance",
            Statement: "Documented issuance.",
            SourceIds: new[] { sourceId },
            ObservedFactReferences: new[]
            {
                new ObservedFactReference(ObservedFactIds.MintAuthorityActive, "true", "true", null)
            },
            ExtractionNote: "extracted");
    }

    private static ResearchTrustAssessment CreateFailClosedAssessment()
    {
        return new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Unconfirmed, false, new[] { "no trusted assessor evidence" }),
            Sources: Array.Empty<AssessedResearchSource>());
    }

    private static ResearchTrustAssessment CreateTrustedAssessment()
    {
        return new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Confirmed, true, new[] { "trusted exact mint evidence" }),
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

    private static ResearchTrustAssessment CreateTrustWithIdentity(ResearchIdentityMatch match, bool hasExactMintMatch)
    {
        return new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(match, hasExactMintMatch, new[] { "assessment" }),
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
}
