using System.Text.Json;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class ProtocolResearchModelsTests
{
    [Fact]
    public void ProtocolResearchContext_SerializesAndDeserializes_WithStableEnumsAndClaims()
    {
        var context = new ProtocolResearchContext(
            Protocol: "example-protocol",
            Sources: new[]
            {
                new ResearchSource(
                    Id: "example-source",
                    SourceType: ResearchSourceType.OfficialDocumentation,
                    Title: "Example Docs",
                    Publisher: "Example Org",
                    Url: "https://example.org/docs",
                    RetrievedAtUtc: null,
                    PublishedAtUtc: null)
            },
            Claims: new[]
            {
                new DocumentedClaim(
                    Id: "EXAMPLE_CLAIM",
                    Category: "issuance",
                    Statement: "Example claim",
                    VerificationStatus: ResearchClaimVerificationStatus.Documented,
                    VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                    SourceIds: new[] { "example-source" },
                    ObservedFactReferences: new[]
                    {
                        new ObservedFactReference(
                            FactId: ObservedFactIds.MintAuthorityActive,
                            ObservedValue: "true",
                            ExpectedValue: null,
                            Note: "Observed from on-chain state")
                    },
                    VerificationNote: null)
            });

        var json = JsonSerializer.Serialize(context);
        var roundTrip = JsonSerializer.Deserialize<ProtocolResearchContext>(json);

        Assert.NotNull(roundTrip);
        Assert.Equal("example-protocol", roundTrip.Protocol);
        Assert.Equal(ResearchSourceType.OfficialDocumentation, roundTrip.Sources[0].SourceType);
        Assert.Equal(ResearchClaimVerificationStatus.Documented, roundTrip.Claims[0].VerificationStatus);
        Assert.Equal(ResearchClaimVerificationMethod.DocumentationOnly, roundTrip.Claims[0].VerificationMethod);
        Assert.Equal(ObservedConsistency.Unknown, roundTrip.Claims[0].Consistency);
    }

    [Fact]
    public void ResearchSource_StoresProvenanceFields()
    {
        var publishedAt = new DateTimeOffset(2026, 7, 28, 0, 0, 0, TimeSpan.Zero);
        var source = new ResearchSource(
            Id: "solana-mobile-skr-tokenomics",
            SourceType: ResearchSourceType.OfficialDocumentation,
            Title: "Solana Mobile SKR docs",
            Publisher: "Solana Mobile",
            Url: "https://docs.solanamobile.com/solana-mobile-stack/skr",
            RetrievedAtUtc: null,
            PublishedAtUtc: publishedAt);

        Assert.Equal("solana-mobile-skr-tokenomics", source.Id);
        Assert.Equal(ResearchSourceType.OfficialDocumentation, source.SourceType);
        Assert.Equal("Solana Mobile", source.Publisher);
        Assert.Equal(publishedAt, source.PublishedAtUtc);
    }

    [Fact]
    public void DocumentedClaim_DocumentedStatusDoesNotImplyVerified()
    {
        var claim = new DocumentedClaim(
            Id: "CLAIM",
            Category: "issuance",
            Statement: "Documented but not reconciled",
            VerificationStatus: ResearchClaimVerificationStatus.Documented,
            VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
            SourceIds: new[] { "src" },
            ObservedFactReferences: Array.Empty<ObservedFactReference>(),
            VerificationNote: null);

        Assert.Equal(ResearchClaimVerificationStatus.Documented, claim.VerificationStatus);
        Assert.Equal(ObservedConsistency.Unknown, claim.Consistency);
    }

    [Fact]
    public void DocumentedClaim_MatchingObservationIsConsistentButNotVerified()
    {
        var claim = new DocumentedClaim(
            Id: "CLAIM",
            Category: "issuance",
            Statement: "Documented issuance",
            VerificationStatus: ResearchClaimVerificationStatus.Documented,
            VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
            SourceIds: new[] { "src" },
            ObservedFactReferences: Array.Empty<ObservedFactReference>(),
            VerificationNote: null,
            Consistency: ObservedConsistency.Consistent);

        Assert.Equal(ObservedConsistency.Consistent, claim.Consistency);
        Assert.NotEqual(ResearchClaimVerificationStatus.Verified, claim.VerificationStatus);
    }

    [Fact]
    public void DocumentedClaim_OnlyDeterministicVerificationMayMarkVerified()
    {
        Assert.Throws<ArgumentException>(() => new DocumentedClaim(
            Id: "CLAIM",
            Category: "issuance",
            Statement: "Invalid verification method",
            VerificationStatus: ResearchClaimVerificationStatus.Verified,
            VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
            SourceIds: new[] { "src" },
            ObservedFactReferences: Array.Empty<ObservedFactReference>(),
            VerificationNote: null));
    }

    [Fact]
    public void DocumentedClaim_DeterministicRelationshipProofMayBeVerified()
    {
        var claim = new DocumentedClaim(
            Id: "CLAIM",
            Category: "control",
            Statement: "The documented control mechanism matches the observed relationship.",
            VerificationStatus: ResearchClaimVerificationStatus.Verified,
            VerificationMethod: ResearchClaimVerificationMethod.DeterministicReconciliation,
            SourceIds: new[] { "src" },
            ObservedFactReferences: Array.Empty<ObservedFactReference>(),
            VerificationNote: null,
            Consistency: ObservedConsistency.Consistent);

        Assert.Equal(ResearchClaimVerificationStatus.Verified, claim.VerificationStatus);
    }

    [Fact]
    public void DocumentedClaim_ConflictingObservationIsSeparateFromVerification()
    {
        var claim = new DocumentedClaim(
            Id: "CLAIM",
            Category: "issuance",
            Statement: "Documented issuance",
            VerificationStatus: ResearchClaimVerificationStatus.Documented,
            VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
            SourceIds: new[] { "src" },
            ObservedFactReferences: Array.Empty<ObservedFactReference>(),
            VerificationNote: null,
            Consistency: ObservedConsistency.Conflict);

        Assert.Equal(ObservedConsistency.Conflict, claim.Consistency);
        Assert.Equal(ResearchClaimVerificationStatus.Documented, claim.VerificationStatus);
    }

    [Fact]
    public void ObservedFactReferences_UseStableSemanticIdentifiers()
    {
        var factReference = new ObservedFactReference(
            FactId: ObservedFactIds.MintAuthorityAddress,
            ObservedValue: "AuthPubkey",
            ExpectedValue: null,
            Note: "Observed authority address");

        Assert.Equal("mint.authority.address", factReference.FactId);
        Assert.Equal("AuthPubkey", factReference.ObservedValue);
    }
}
