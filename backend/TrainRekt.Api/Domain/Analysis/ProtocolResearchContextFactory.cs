using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Domain.Analysis;

public static class ProtocolResearchContextFactory
{
    public static ProtocolResearchContext? Create(TokenInspection inspection)
    {
        if (!string.Equals(inspection.Identity.Mint, ProtocolConstants.SolanaMobileSkrMint, StringComparison.Ordinal))
        {
            return null;
        }

        var tokenomicsSource = new ResearchSource(
            Id: ProtocolConstants.SolanaMobileSkrTokenomicsSourceId,
            SourceType: ResearchSourceType.OfficialDocumentation,
            Title: "Solana Mobile SKR docs",
            Publisher: "Solana Mobile",
            Url: "https://docs.solanamobile.com/solana-mobile-stack/skr",
            RetrievedAtUtc: null,
            PublishedAtUtc: null);

        var stakingIdlSource = new ResearchSource(
            Id: ProtocolConstants.SolanaMobileSkrStakingIdlSourceId,
            SourceType: ResearchSourceType.OfficialIdl,
            Title: "Solana Mobile SKR staking IDL",
            Publisher: "Solana Mobile",
            Url: "https://raw.githubusercontent.com/solana-mobile/react-native-samples/main/skr-staking/program/idl.json",
            RetrievedAtUtc: null,
            PublishedAtUtc: null);

        var mintAuthorityActive = !inspection.Authorities.MintAuthorityRevoked;

        var issuanceClaim = new DocumentedClaim(
            Id: "DOCUMENTED_INFLATIONARY_ISSUANCE",
            Category: "issuance",
            Statement: "SKR documentation describes ongoing inflationary issuance associated with staking rewards.",
            VerificationStatus: ResearchClaimVerificationStatus.Documented,
            VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
            Consistency: mintAuthorityActive
                ? ObservedConsistency.Consistent
                : ObservedConsistency.Conflict,
            SourceIds: new[]
            {
                tokenomicsSource.Id
            },
            ObservedFactReferences: new[]
            {
                new ObservedFactReference(
                    FactId: ObservedFactIds.MintAuthorityActive,
                    ObservedValue: mintAuthorityActive ? "true" : "false",
                    ExpectedValue: "true",
                    Note: "Active mint authority state is expected for ongoing issuance."),
                new ObservedFactReference(
                    FactId: ObservedFactIds.MintAuthorityAddress,
                    ObservedValue: inspection.Authorities.MintAuthority,
                    ExpectedValue: null,
                    Note: "Authority identity is tracked separately from issuance-state consistency.")
            },
            VerificationNote: mintAuthorityActive
                ? "Observed active mint-authority state is consistent with the documented inflationary model."
                : "Documented inflationary issuance conflicts with observed revoked mint authority state.");

        var authorityIdentityClaim = new DocumentedClaim(
            Id: "MINT_AUTHORITY_IDENTITY_MATCHES_DOCUMENTED_ISSUANCE_CONTROL",
            Category: "mint_authority",
            Statement: "The current mint-authority identity is deterministically tied to a documented issuance-control mechanism.",
            VerificationStatus: ResearchClaimVerificationStatus.NotVerified,
            VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
            SourceIds: new[]
            {
                tokenomicsSource.Id,
                stakingIdlSource.Id
            },
            ObservedFactReferences: new[]
            {
                new ObservedFactReference(
                    FactId: ObservedFactIds.MintAuthorityAddress,
                    ObservedValue: inspection.Authorities.MintAuthority,
                    ExpectedValue: null,
                    Note: "Current authority address is observed but not linked to a documented issuance-control key/mechanism."
                )
            },
            VerificationNote: "Official SKR sources document issuance but do not identify an exact deterministic authority identity mapping for the current mint authority.");

        return new ProtocolResearchContext(
            Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
            Sources: new[]
            {
                tokenomicsSource,
                stakingIdlSource
            },
            Claims: new[]
            {
                issuanceClaim,
                authorityIdentityClaim
            });
    }
}
