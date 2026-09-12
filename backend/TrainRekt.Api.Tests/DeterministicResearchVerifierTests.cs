using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class DeterministicResearchVerifierTests
{
    [Fact]
    public void Reconcile_DocumentedIssuanceWithActiveAuthority_SetsConsistentNotVerified()
    {
        var verifier = new DeterministicResearchVerifier();
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);
        var context = CreateContext(CreateIssuanceClaim());

        var reconciled = verifier.Reconcile(inspection, context);

        var claim = Assert.Single(reconciled.Claims);
        Assert.Equal(ObservedConsistency.Consistent, claim.Consistency);
        Assert.Equal(ResearchClaimVerificationStatus.Documented, claim.VerificationStatus);
    }

    [Fact]
    public void Reconcile_DocumentedIssuanceWithRevokedAuthority_SetsConflictNotVerified()
    {
        var verifier = new DeterministicResearchVerifier();
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: true);
        var context = CreateContext(CreateIssuanceClaim());

        var reconciled = verifier.Reconcile(inspection, context);

        var claim = Assert.Single(reconciled.Claims);
        Assert.Equal(ObservedConsistency.Conflict, claim.Consistency);
        Assert.Equal(ResearchClaimVerificationStatus.Documented, claim.VerificationStatus);
    }

    [Fact]
    public void Reconcile_AuthorityIdentityWithoutDeterministicProof_RemainsNotVerified()
    {
        var verifier = new DeterministicResearchVerifier();
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false);
        var claim = new DocumentedClaim(
            Id: ResearchClaimIds.MintAuthorityIdentityMatchesDocumentedIssuanceControl,
            Category: "mint_authority",
            Statement: "Identity is documented",
            VerificationStatus: ResearchClaimVerificationStatus.Documented,
            VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
            SourceIds: new[] { "src" },
            ObservedFactReferences: Array.Empty<ObservedFactReference>(),
            VerificationNote: null,
            Consistency: ObservedConsistency.Consistent);

        var reconciled = verifier.Reconcile(inspection, CreateContext(claim));

        var identityClaim = Assert.Single(reconciled.Claims);
        Assert.Equal(ResearchClaimVerificationStatus.NotVerified, identityClaim.VerificationStatus);
        Assert.Equal(ObservedConsistency.Unknown, identityClaim.Consistency);
    }

    private static ProtocolResearchContext CreateContext(DocumentedClaim claim)
    {
        return new ProtocolResearchContext(
            Protocol: "example",
            Sources: new[]
            {
                new ResearchSource("src", ResearchSourceType.OfficialDocumentation, "Docs", "Org", "https://example.com/docs", null, null)
            },
            Claims: new[] { claim });
    }

    private static DocumentedClaim CreateIssuanceClaim()
    {
        return new DocumentedClaim(
            Id: ResearchClaimIds.DocumentedInflationaryIssuance,
            Category: "issuance",
            Statement: "Ongoing issuance is documented.",
            VerificationStatus: ResearchClaimVerificationStatus.Documented,
            VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
            SourceIds: new[] { "src" },
            ObservedFactReferences: Array.Empty<ObservedFactReference>(),
            VerificationNote: null,
            Consistency: ObservedConsistency.Unknown);
    }
}
