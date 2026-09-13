using System.Text.Json;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class AiSafetyCoachInputFactoryTests
{
    [Fact]
    public void Create_DoesNotIncludeMintOrAddressesInSerializedInput()
    {
        var factory = CreateFactory();
        var inspection = ResearchTestData.CreateInspection(
            mintAuthorityRevoked: false,
            freezeAuthorityRevoked: false,
            protocolContext: CreateProtocolContext());

        var input = factory.Create(inspection);
        var json = JsonSerializer.Serialize(input);

        Assert.DoesNotContain(inspection.Identity.Mint, json, StringComparison.Ordinal);
        Assert.DoesNotContain(inspection.Authorities.MintAuthority!, json, StringComparison.Ordinal);
        Assert.DoesNotContain(inspection.Authorities.FreezeAuthority!, json, StringComparison.Ordinal);
    }

    [Fact]
    public void Create_BoundsCollectionsAndStrings()
    {
        var factory = CreateFactory(new AiSafetyCoachOptions
        {
            MaxReviewSignals = 1,
            MaxClaimSummaries = 1,
            MaxSourcesPerClaim = 1,
            MaxListItemLength = 10,
            MaxProtocolBreakdownItems = 1,
            MaxEvidencePerSignal = 1,
            MaxUncertaintyItems = 1
        });

        var inspection = ResearchTestData.CreateInspection(protocolContext: CreateProtocolContext()) with
        {
            ReviewSignals = new[]
            {
                new TokenReviewSignal("A", "cat", "sev", "this explanation is long", new Dictionary<string, string> { ["first"] = "value1", ["second"] = "value2" }),
                new TokenReviewSignal("B", "cat", "sev", "this explanation is long", new Dictionary<string, string>())
            },
            LargestTokenAccounts = new[]
            {
                CreateAccount("proto1", "role1"),
                CreateAccount("proto2", "role2")
            }
        };

        var input = factory.Create(inspection);

        Assert.Single(input.ReviewSignals);
        Assert.True(input.ReviewSignals[0].Explanation.Length <= 10);
        Assert.Single(input.ReviewSignals[0].Evidence);
        Assert.Single(input.TrustedClaimSummaries);
        Assert.Single(input.TrustedClaimSummaries[0].SourcePublishers);
        Assert.Single(input.ProtocolBreakdown);
        Assert.Single(input.UncertaintyMarkers);
    }

    private static AiSafetyCoachInputFactory CreateFactory(AiSafetyCoachOptions? options = null)
    {
        return new AiSafetyCoachInputFactory(Options.Create(options ?? new AiSafetyCoachOptions()));
    }

    private static ProtocolResearchContext CreateProtocolContext()
    {
        return new ProtocolResearchContext(
            Protocol: "proto",
            Sources: new[]
            {
                new ResearchSource("s1", ResearchSourceType.OfficialDocumentation, "title", "publisher1", "https://example.com/a", null, null),
                new ResearchSource("s2", ResearchSourceType.OfficialDocumentation, "title", "publisher2", "https://example.com/b", null, null)
            },
            Claims: new[]
            {
                new DocumentedClaim(
                    Id: "C1",
                    Category: "cat",
                    Statement: "statement should be trimmed by limit",
                    VerificationStatus: ResearchClaimVerificationStatus.Documented,
                    VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                    SourceIds: new[] { "s1", "s2" },
                    ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                    VerificationNote: null,
                    Consistency: ObservedConsistency.Conflict),
                new DocumentedClaim(
                    Id: "C2",
                    Category: "cat",
                    Statement: "other",
                    VerificationStatus: ResearchClaimVerificationStatus.Documented,
                    VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                    SourceIds: new[] { "s1" },
                    ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                    VerificationNote: null,
                    Consistency: ObservedConsistency.Unknown)
            });
    }

    private static AnalyzedTokenAccount CreateAccount(string protocol, string role)
    {
        return new AnalyzedTokenAccount(
            Address: "address",
            Authority: null,
            Mint: null,
            TokenProgram: null,
            RawAmount: "100",
            Percentage: 10m,
            Classification: new TokenAccountClassification(role, protocol, "strong", Array.Empty<TokenAccountClassificationEvidence>()));
    }
}