using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Application.Research;

public sealed class DeterministicResearchVerifier
{
    public ProtocolResearchContext Reconcile(TokenInspection inspection, ProtocolResearchContext context)
    {
        var reconciledClaims = context.Claims.Select(claim => ReconcileClaim(inspection, claim)).ToArray();
        return context with { Claims = reconciledClaims };
    }

    private static DocumentedClaim ReconcileClaim(TokenInspection inspection, DocumentedClaim claim)
    {
        if (string.Equals(claim.Id, ResearchClaimIds.DocumentedInflationaryIssuance, StringComparison.Ordinal))
        {
            var consistency = inspection.Authorities.MintAuthorityRevoked
                ? ObservedConsistency.Conflict
                : ObservedConsistency.Consistent;

            return claim with
            {
                Consistency = consistency,
                VerificationStatus = claim.VerificationStatus == ResearchClaimVerificationStatus.Verified
                    ? claim.VerificationStatus
                    : ResearchClaimVerificationStatus.Documented,
                VerificationMethod = claim.VerificationStatus == ResearchClaimVerificationStatus.Verified
                    ? claim.VerificationMethod
                    : ResearchClaimVerificationMethod.DocumentationOnly
            };
        }

        if (string.Equals(claim.Id, ResearchClaimIds.MintAuthorityIdentityMatchesDocumentedIssuanceControl, StringComparison.Ordinal))
        {
            return claim with
            {
                VerificationStatus = ResearchClaimVerificationStatus.NotVerified,
                VerificationMethod = ResearchClaimVerificationMethod.DocumentationOnly,
                Consistency = ObservedConsistency.Unknown
            };
        }

        return claim;
    }
}
