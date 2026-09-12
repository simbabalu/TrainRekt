using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Domain.Analysis;

public static class TokenProtocolContextFactory
{
    public static TokenProtocolContext? Create(TokenInspection inspection)
    {
        if (!string.Equals(inspection.Identity.Mint, ProtocolConstants.SolanaMobileSkrMint, StringComparison.Ordinal))
        {
            return null;
        }

        return new TokenProtocolContext(
            Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
            Issuance: new TokenIssuanceProtocolContext(
                Classification: "documented_inflationary_issuance",
                Verification: "official_documentation",
                SourceIds: new[]
                {
                    ProtocolConstants.SolanaMobileSkrTokenomicsSourceId,
                    ProtocolConstants.SolanaMobileSkrStakingIdlSourceId
                },
                MintAuthorityStateConsistentWithDocumentedModel: !inspection.Authorities.MintAuthorityRevoked,
                MintAuthorityIdentityVerified: false,
                MintAuthorityIdentityVerificationNote: "Official SKR sources document ongoing inflation and staking rewards, but do not deterministically bind the current mint-authority key to a specific documented issuance-control account."));
    }
}
