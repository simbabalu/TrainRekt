using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public sealed class ResearchNeedDetector
{
    private readonly TokenResearchOptions _options;

    public ResearchNeedDetector(TokenResearchOptions options)
    {
        _options = options;
    }

    public IReadOnlyList<ResearchNeed> Detect(TokenInspection inspection)
    {
        var needs = new List<ResearchNeed>();

        if (!inspection.Authorities.MintAuthorityRevoked && !HasMintAuthorityContext(inspection.ProtocolContext))
        {
            needs.Add(new ResearchNeed(
                Id: "ACTIVE_MINT_AUTHORITY_WITHOUT_CONTEXT",
                Category: ResearchNeedCategory.ActiveMintAuthorityWithoutContext,
                Priority: ResearchNeedPriority.High,
                ObservedFactReferences: new[]
                {
                    new ObservedFactReference(
                        FactId: ObservedFactIds.MintAuthorityActive,
                        ObservedValue: "true",
                        ExpectedValue: null,
                        Note: "Mint authority is active without documented issuance context."),
                    new ObservedFactReference(
                        FactId: ObservedFactIds.MintAuthorityAddress,
                        ObservedValue: inspection.Authorities.MintAuthority,
                        ExpectedValue: null,
                        Note: "Current authority identity is unresolved.")
                },
                Reason: "Active mint authority should be reviewed against documented issuance controls."));
        }

        if (!inspection.Authorities.FreezeAuthorityRevoked && !HasFreezeAuthorityContext(inspection.ProtocolContext))
        {
            needs.Add(new ResearchNeed(
                Id: "ACTIVE_FREEZE_AUTHORITY_WITHOUT_CONTEXT",
                Category: ResearchNeedCategory.ActiveFreezeAuthorityWithoutContext,
                Priority: ResearchNeedPriority.Medium,
                ObservedFactReferences: new[]
                {
                    new ObservedFactReference(
                        FactId: ObservedFactIds.FreezeAuthorityActive,
                        ObservedValue: "true",
                        ExpectedValue: null,
                        Note: "Freeze authority is active without documented purpose."),
                    new ObservedFactReference(
                        FactId: ObservedFactIds.FreezeAuthorityAddress,
                        ObservedValue: inspection.Authorities.FreezeAuthority,
                        ExpectedValue: null,
                        Note: "Current freeze authority identity is unresolved.")
                },
                Reason: "Active freeze authority should be reviewed against documented controls."));
        }

        var largestUnknown = inspection.HolderConcentration.UnclassifiedTokenAccountConcentration?.LargestUnknownTokenAccountPercentage;
        if (largestUnknown is decimal percentage
            && percentage >= _options.LargestUnknownTokenAccountThresholdPercent)
        {
            needs.Add(new ResearchNeed(
                Id: "LARGE_UNCLASSIFIED_TOKEN_ACCOUNT",
                Category: ResearchNeedCategory.LargeUnclassifiedTokenAccount,
                Priority: ResearchNeedPriority.Medium,
                ObservedFactReferences: new[]
                {
                    new ObservedFactReference(
                        FactId: ObservedFactIds.LargestUnknownTokenAccountPercentage,
                        ObservedValue: percentage.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        ExpectedValue: _options.LargestUnknownTokenAccountThresholdPercent.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        Note: "Largest unknown token-account concentration exceeds threshold and remains unexplained.")
                },
                Reason: "A large unknown token-account concentration may benefit from documented context."));
        }

        return needs;
    }

    private static bool HasMintAuthorityContext(ProtocolResearchContext? context)
    {
        return context?.Claims.Any(claim =>
            string.Equals(claim.Category, "issuance", StringComparison.OrdinalIgnoreCase)
            || string.Equals(claim.Category, "mint_authority", StringComparison.OrdinalIgnoreCase)
            || claim.ObservedFactReferences.Any(fact =>
                fact.FactId == ObservedFactIds.MintAuthorityActive
                || fact.FactId == ObservedFactIds.MintAuthorityAddress)) == true;
    }

    private static bool HasFreezeAuthorityContext(ProtocolResearchContext? context)
    {
        return context?.Claims.Any(claim =>
            string.Equals(claim.Category, "freeze_authority", StringComparison.OrdinalIgnoreCase)
            || claim.ObservedFactReferences.Any(fact =>
                fact.FactId == ObservedFactIds.FreezeAuthorityActive
                || fact.FactId == ObservedFactIds.FreezeAuthorityAddress)) == true;
    }
}
