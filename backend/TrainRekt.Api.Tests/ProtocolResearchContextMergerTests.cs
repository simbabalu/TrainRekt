using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class ProtocolResearchContextMergerTests
{
    [Fact]
    public void Merge_ExistingVerifiedClaim_CannotBeOverwritten()
    {
        var merger = new ProtocolResearchContextMerger();
        var existing = CreateContext(CreateClaim(
            claimId: ResearchClaimIds.DocumentedInflationaryIssuance,
            statement: "Deterministically verified relationship",
            status: ResearchClaimVerificationStatus.Verified,
            method: ResearchClaimVerificationMethod.DeterministicReconciliation,
            consistency: ObservedConsistency.Consistent,
            sourceId: "src-a"));

        var incoming = CreateContext(CreateClaim(
            claimId: ResearchClaimIds.DocumentedInflationaryIssuance,
            statement: "Different external claim",
            status: ResearchClaimVerificationStatus.Documented,
            method: ResearchClaimVerificationMethod.DocumentationOnly,
            consistency: ObservedConsistency.Unknown,
            sourceId: "src-b"));

        var merged = merger.Merge(existing, incoming);

        var claim = Assert.Single(merged.Context!.Claims);
        Assert.Equal(ResearchClaimVerificationStatus.Verified, claim.VerificationStatus);
        Assert.Equal("Deterministically verified relationship", claim.Statement);
    }

    [Fact]
    public void Merge_ExternalDocumentedClaim_CannotDowngradeVerified()
    {
        var merger = new ProtocolResearchContextMerger();
        var existing = CreateContext(CreateClaim(
            claimId: "CLAIM",
            statement: "Verified claim",
            status: ResearchClaimVerificationStatus.Verified,
            method: ResearchClaimVerificationMethod.DeterministicReconciliation,
            consistency: ObservedConsistency.Consistent,
            sourceId: "src-a"));

        var incoming = CreateContext(CreateClaim(
            claimId: "CLAIM",
            statement: "Verified claim",
            status: ResearchClaimVerificationStatus.Documented,
            method: ResearchClaimVerificationMethod.DocumentationOnly,
            consistency: ObservedConsistency.Consistent,
            sourceId: "src-b"));

        var merged = merger.Merge(existing, incoming);

        Assert.Equal(ResearchClaimVerificationStatus.Verified, merged.Context!.Claims[0].VerificationStatus);
        Assert.Equal(1, merged.ClaimsRejected);
    }

    [Fact]
    public void Merge_CompatibleDuplicateClaim_MergesSourceIdsDeterministically()
    {
        var merger = new ProtocolResearchContextMerger();
        var existing = CreateContext(CreateClaim("CLAIM", "Same statement", ResearchClaimVerificationStatus.Documented, ResearchClaimVerificationMethod.DocumentationOnly, ObservedConsistency.Unknown, "src-b"));
        var incoming = CreateContext(CreateClaim("CLAIM", "Same statement", ResearchClaimVerificationStatus.Documented, ResearchClaimVerificationMethod.DocumentationOnly, ObservedConsistency.Unknown, "src-a"));

        var merged = merger.Merge(existing, incoming);

        var claim = Assert.Single(merged.Context!.Claims);
        Assert.Equal(new[] { "src-a", "src-b" }, claim.SourceIds);
    }

    [Fact]
    public void Merge_ConflictingSameIdClaim_DoesNotSilentlyReplace()
    {
        var merger = new ProtocolResearchContextMerger();
        var existing = CreateContext(CreateClaim("CLAIM", "Original", ResearchClaimVerificationStatus.Documented, ResearchClaimVerificationMethod.DocumentationOnly, ObservedConsistency.Unknown, "src-a"));
        var incoming = CreateContext(CreateClaim("CLAIM", "Changed", ResearchClaimVerificationStatus.Documented, ResearchClaimVerificationMethod.DocumentationOnly, ObservedConsistency.Unknown, "src-b"));

        var merged = merger.Merge(existing, incoming);

        var claim = Assert.Single(merged.Context!.Claims);
        Assert.Equal("Original", claim.Statement);
        Assert.Equal(1, merged.ClaimsRejected);
    }

    private static ProtocolResearchContext CreateContext(DocumentedClaim claim)
    {
        return new ProtocolResearchContext(
            Protocol: "p",
            Sources: new[]
            {
                new ResearchSource("src-a", ResearchSourceType.OfficialDocumentation, "A", "Org", "https://example.com/a", null, null),
                new ResearchSource("src-b", ResearchSourceType.OfficialRepository, "B", "Org", "https://example.com/b", null, null)
            },
            Claims: new[] { claim });
    }

    private static DocumentedClaim CreateClaim(
        string claimId,
        string statement,
        ResearchClaimVerificationStatus status,
        ResearchClaimVerificationMethod method,
        ObservedConsistency consistency,
        string sourceId)
    {
        return new DocumentedClaim(
            Id: claimId,
            Category: "issuance",
            Statement: statement,
            VerificationStatus: status,
            VerificationMethod: method,
            SourceIds: new[] { sourceId },
            ObservedFactReferences: Array.Empty<ObservedFactReference>(),
            VerificationNote: null,
            Consistency: consistency);
    }
}
