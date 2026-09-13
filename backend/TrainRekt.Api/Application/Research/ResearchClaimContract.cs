using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Application.Research;

public static class ResearchClaimContract
{
    public const string CategoryIssuance = "issuance";
    public const string CategoryMintAuthority = "mint_authority";
    public const string CategoryFreezeAuthority = "freeze_authority";
    public const string CategoryStakingVault = "staking_vault";
    public const string CategoryProtocolVault = "protocol_vault";
    public const string CategoryTokenomics = "tokenomics";

    private static readonly Dictionary<string, string> ClaimCategoryById = new(StringComparer.Ordinal)
    {
        [ResearchClaimIds.DocumentedInflationaryIssuance] = CategoryIssuance,
        [ResearchClaimIds.MintAuthorityIdentityMatchesDocumentedIssuanceControl] = CategoryMintAuthority,
        [ResearchClaimIds.DocumentedMintAuthorityPurpose] = CategoryMintAuthority,
        [ResearchClaimIds.DocumentedFreezeAuthorityPurpose] = CategoryFreezeAuthority,
        [ResearchClaimIds.DocumentedStakingVault] = CategoryStakingVault,
        [ResearchClaimIds.DocumentedProtocolVault] = CategoryProtocolVault,
        [ResearchClaimIds.DocumentedTokenomics] = CategoryTokenomics
    };

    private static readonly Dictionary<ResearchNeedCategory, string[]> ClaimIdsByNeedCategory = new()
    {
        [ResearchNeedCategory.ActiveMintAuthorityWithoutContext] =
        [
            ResearchClaimIds.DocumentedInflationaryIssuance,
            ResearchClaimIds.MintAuthorityIdentityMatchesDocumentedIssuanceControl,
            ResearchClaimIds.DocumentedMintAuthorityPurpose,
            ResearchClaimIds.DocumentedTokenomics
        ],
        [ResearchNeedCategory.ActiveFreezeAuthorityWithoutContext] =
        [
            ResearchClaimIds.DocumentedFreezeAuthorityPurpose,
            ResearchClaimIds.DocumentedTokenomics
        ],
        [ResearchNeedCategory.LargeUnclassifiedTokenAccount] =
        [
            ResearchClaimIds.DocumentedStakingVault,
            ResearchClaimIds.DocumentedProtocolVault,
            ResearchClaimIds.DocumentedTokenomics
        ]
    };

    public static IReadOnlyList<string> GetAllSupportedClaimIds()
    {
        return ClaimCategoryById.Keys
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToArray();
    }

    public static IReadOnlyList<string> GetAllSupportedCategories()
    {
        return ClaimCategoryById.Values
            .Distinct(StringComparer.Ordinal)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
    }

    public static bool IsSupportedClaimId(string claimId)
    {
        return ClaimCategoryById.ContainsKey(claimId);
    }

    public static bool IsClaimCategoryCompatible(string claimId, string category)
    {
        return ClaimCategoryById.TryGetValue(claimId, out var expectedCategory)
            && string.Equals(expectedCategory, category, StringComparison.Ordinal);
    }

    public static bool TryGetCategoryForClaimId(string claimId, out string category)
    {
        return ClaimCategoryById.TryGetValue(claimId, out category!);
    }

    public static IReadOnlyList<string> GetAllowedClaimIdsForNeeds(IReadOnlyList<ResearchNeed> needs)
    {
        if (needs.Count == 0)
        {
            return GetAllSupportedClaimIds();
        }

        var hasUnknownNeedCategory = false;
        var allowed = new HashSet<string>(StringComparer.Ordinal);

        foreach (var needCategory in needs.Select(need => need.Category).Distinct())
        {
            if (!ClaimIdsByNeedCategory.TryGetValue(needCategory, out var claimIds))
            {
                hasUnknownNeedCategory = true;
                continue;
            }

            foreach (var claimId in claimIds)
            {
                allowed.Add(claimId);
            }
        }

        if (hasUnknownNeedCategory || allowed.Count == 0)
        {
            return GetAllSupportedClaimIds();
        }

        return allowed.OrderBy(id => id, StringComparer.Ordinal).ToArray();
    }

    public static IReadOnlyList<string> GetAllowedCategoriesForClaimIds(IReadOnlyList<string> claimIds)
    {
        var categories = new HashSet<string>(StringComparer.Ordinal);
        foreach (var claimId in claimIds)
        {
            if (ClaimCategoryById.TryGetValue(claimId, out var category))
            {
                categories.Add(category);
            }
        }

        return categories.OrderBy(category => category, StringComparer.Ordinal).ToArray();
    }
}