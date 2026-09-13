using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Tests;

public sealed class ResearchClaimContractTests
{
    [Fact]
    public void GetAllowedClaimIdsForNeeds_MintAuthorityNeed_ReturnsNarrowedDeterministicSet()
    {
        var needs = new[]
        {
            new ResearchNeed(
                Id: "ACTIVE_MINT_AUTHORITY_WITHOUT_CONTEXT",
                Category: ResearchNeedCategory.ActiveMintAuthorityWithoutContext,
                Priority: ResearchNeedPriority.High,
                ObservedFactReferences: Array.Empty<TrainRekt.Api.Domain.Models.ObservedFactReference>(),
                Reason: "reason")
        };

        var allowed = ResearchClaimContract.GetAllowedClaimIdsForNeeds(needs);

        Assert.Equal(
            new[]
            {
                ResearchClaimIds.DocumentedInflationaryIssuance,
                ResearchClaimIds.DocumentedMintAuthorityPurpose,
                ResearchClaimIds.DocumentedTokenomics,
                ResearchClaimIds.MintAuthorityIdentityMatchesDocumentedIssuanceControl
            },
            allowed);
    }

    [Fact]
    public void GetAllowedClaimIdsForNeeds_NoNeeds_ReturnsAllSupportedClaims()
    {
        var allowed = ResearchClaimContract.GetAllowedClaimIdsForNeeds(Array.Empty<ResearchNeed>());

        Assert.Equal(ResearchClaimContract.GetAllSupportedClaimIds(), allowed);
    }

    [Fact]
    public void IsClaimCategoryCompatible_ValidAndInvalidPairs_AreDeterministic()
    {
        Assert.True(ResearchClaimContract.IsClaimCategoryCompatible(
            ResearchClaimIds.DocumentedInflationaryIssuance,
            ResearchClaimContract.CategoryIssuance));

        Assert.False(ResearchClaimContract.IsClaimCategoryCompatible(
            ResearchClaimIds.DocumentedInflationaryIssuance,
            ResearchClaimContract.CategoryTokenomics));
    }
}
