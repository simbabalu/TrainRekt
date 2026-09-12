using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class ResearchNeedDetectorTests
{
    [Fact]
    public void Detect_ActiveMintAuthorityWithoutContext_AddsNeed()
    {
        var detector = new ResearchNeedDetector(new TokenResearchOptions());
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false, protocolContext: null);

        var needs = detector.Detect(inspection);

        Assert.Contains(needs, need => need.Category == ResearchNeedCategory.ActiveMintAuthorityWithoutContext);
    }

    [Fact]
    public void Detect_ActiveMintAuthorityWithExistingContext_DoesNotDuplicateNeed()
    {
        var detector = new ResearchNeedDetector(new TokenResearchOptions());
        var context = new ProtocolResearchContext(
            Protocol: "known",
            Sources: new[]
            {
                new ResearchSource("src", ResearchSourceType.OfficialDocumentation, "Docs", "Org", "https://example.com/docs", null, null)
            },
            Claims: new[]
            {
                new DocumentedClaim(
                    Id: ResearchClaimIds.DocumentedInflationaryIssuance,
                    Category: "issuance",
                    Statement: "Issuance is documented.",
                    VerificationStatus: ResearchClaimVerificationStatus.Documented,
                    VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                    SourceIds: new[] { "src" },
                    ObservedFactReferences: new[]
                    {
                        new ObservedFactReference(ObservedFactIds.MintAuthorityActive, "true", "true", null)
                    },
                    VerificationNote: null,
                    Consistency: ObservedConsistency.Consistent)
            });

        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false, protocolContext: context);

        var needs = detector.Detect(inspection);

        Assert.DoesNotContain(needs, need => need.Category == ResearchNeedCategory.ActiveMintAuthorityWithoutContext);
    }

    [Fact]
    public void Detect_ActiveFreezeAuthorityWithoutContext_AddsNeed()
    {
        var detector = new ResearchNeedDetector(new TokenResearchOptions());
        var inspection = ResearchTestData.CreateInspection(freezeAuthorityRevoked: false, protocolContext: null);

        var needs = detector.Detect(inspection);

        Assert.Contains(needs, need => need.Category == ResearchNeedCategory.ActiveFreezeAuthorityWithoutContext);
    }

    [Fact]
    public void Detect_LargeUnknownTokenAccountAboveThreshold_AddsNeed()
    {
        var detector = new ResearchNeedDetector(new TokenResearchOptions
        {
            LargestUnknownTokenAccountThresholdPercent = 10m
        });

        var inspection = ResearchTestData.CreateInspection(largestUnknownTokenAccountPercentage: 25m);

        var needs = detector.Detect(inspection);

        Assert.Contains(needs, need => need.Category == ResearchNeedCategory.LargeUnclassifiedTokenAccount);
    }

    [Fact]
    public void Detect_UnknownTokenAccountBelowThreshold_DoesNotAddNeed()
    {
        var detector = new ResearchNeedDetector(new TokenResearchOptions
        {
            LargestUnknownTokenAccountThresholdPercent = 10m
        });

        var inspection = ResearchTestData.CreateInspection(largestUnknownTokenAccountPercentage: 9.99m);

        var needs = detector.Detect(inspection);

        Assert.DoesNotContain(needs, need => need.Category == ResearchNeedCategory.LargeUnclassifiedTokenAccount);
    }
}
