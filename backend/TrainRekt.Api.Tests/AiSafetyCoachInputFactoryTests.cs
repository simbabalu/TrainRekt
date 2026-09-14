using System.Text.Json;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
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

    [Fact]
    public void Create_WithIdentityClassification_MapsCompactIdentityContext()
    {
        var factory = CreateFactory();
        var inspection = ResearchTestData.CreateInspection(protocolContext: CreateProtocolContext());
        var provenance = CreateProvenance(TokenIdentityClassificationType.PossibleCopycat);

        var input = factory.Create(inspection, provenance);

        Assert.NotNull(input.Identity);
        Assert.Equal("POSSIBLE_COPYCAT", input.Identity!.Classification);
        Assert.Equal("MEDIUM", input.Identity.Confidence);
        Assert.True(input.Identity.HasMeaningfulCollision);
        Assert.Equal("name-and-symbol", input.Identity.IdentityMatchStrength);
        Assert.True(input.Identity.TrustedSourceReferencesCompetingMint);
        Assert.True(input.Identity.CopyingIntentNotProven);
        Assert.True(input.Identity.GlobalFirstTokenNotProven);
        Assert.True(input.Identity.SocialContextNotAnalyzed);
    }

    [Fact]
    public void Create_WithIdentityClassification_DoesNotSerializeMintAddresses()
    {
        var factory = CreateFactory();
        var inspection = ResearchTestData.CreateInspection(protocolContext: CreateProtocolContext());
        var provenance = CreateProvenance(TokenIdentityClassificationType.PossibleCopycat);

        var input = factory.Create(inspection, provenance);
        var json = JsonSerializer.Serialize(input);

        Assert.DoesNotContain("ScannedMint11111111111111111111111111111111", json, StringComparison.Ordinal);
        Assert.DoesNotContain("CompetingMint2222222222222222222222222222", json, StringComparison.Ordinal);
    }

    [Fact]
    public void Create_WithExternalContext_MapsBoundedSafeFieldsOnly()
    {
        var factory = CreateFactory(new AiSafetyCoachOptions
        {
            MaxListItemLength = 24,
            MaxEvidencePerSignal = 2
        });

        var inspection = ResearchTestData.CreateInspection(protocolContext: CreateProtocolContext());
        var externalContext = new TokenExternalContext(
            TokenExternalContextAvailability.Available,
            TokenExternalAssetType.TokenizedStock,
            "Project With Very Long Name That Should Be Truncated",
            "This summary is intentionally long so we can verify that no arbitrary long source body is passed through unchanged.",
            "MEDIUM",
            true,
            false,
            new[]
            {
                new TokenExternalContextEvidence(
                    TokenExternalContextSourceType.OfficialIssuerDocumentation,
                    "Issuer Document Very Long Title",
                    "issuer.example.com",
                    "Mint appears in issuer docs with administrative transfer controls for compliance operations.",
                    "https://issuer.example.com/docs/very/long/path"),
                new TokenExternalContextEvidence(
                    TokenExternalContextSourceType.StructuredTokenDirectory,
                    "Directory",
                    "directory.example.com",
                    "Directory labels this as tokenized equity.",
                    "https://directory.example.com/token")
            });

        var input = factory.Create(inspection, provenance: null, externalContext);
        var json = JsonSerializer.Serialize(input);

        Assert.NotNull(input.ExternalContext);
        Assert.Equal("AVAILABLE", input.ExternalContext!.Availability);
        Assert.Equal("TOKENIZED_STOCK", input.ExternalContext.AssetType);
        Assert.True(input.ExternalContext.Evidence.Count <= 2);
        Assert.DoesNotContain("very/long/path", json, StringComparison.Ordinal);
    }

    [Fact]
    public void Create_WithAmbiguousSymbolOnlyExternalContext_MarksAmbiguity()
    {
        var factory = CreateFactory();
        var inspection = ResearchTestData.CreateInspection();
        var externalContext = new TokenExternalContext(
            TokenExternalContextAvailability.Unavailable,
            TokenExternalAssetType.Unknown,
            null,
            null,
            "LOW",
            false,
            true,
            Array.Empty<TokenExternalContextEvidence>(),
            TokenExternalContextFailureReason.AmbiguousEvidence);

        var input = factory.Create(inspection, provenance: null, externalContext);

        Assert.NotNull(input.ExternalContext);
        Assert.Equal("UNAVAILABLE", input.ExternalContext!.Availability);
        Assert.True(input.ExternalContext.AmbiguousIdentity);
        Assert.False(input.ExternalContext.MintConfirmed);
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

    private static TokenIdentityProvenance CreateProvenance(TokenIdentityClassificationType classificationType)
    {
        return new TokenIdentityProvenance(
            Result: TokenIdentityProvenanceResultType.CollisionObserved,
            Confidence: TokenIdentityProvenanceConfidence.Medium,
            ScannedIdentity: new TokenIdentityProvenanceScannedIdentity(
                "ScannedMint11111111111111111111111111111111",
                "Name",
                "name",
                "SYM",
                "sym",
                DateTimeOffset.UtcNow),
            EarliestObservedMatch: null,
            Collisions: new[]
            {
                new TokenIdentityCollision(
                    "CompetingMint2222222222222222222222222222",
                    "Name",
                    "SYM",
                    new[] { TokenIdentityMatchDimension.Name, TokenIdentityMatchDimension.Symbol },
                    TokenIdentityMatchLevel.Exact,
                    DateTimeOffset.UtcNow.AddHours(-1),
                    DateTimeOffset.UtcNow)
            },
            TotalCollisionCount: 1,
            ReturnedCollisionCount: 1,
            IsTruncated: false,
            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            ConflictingEvidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Unknowns: Array.Empty<TokenIdentityProvenanceUnknown>(),
            AnalyzedAtUtc: DateTimeOffset.UtcNow,
            OnChainChronology: null,
            TrustedIdentityProvenance: new TrustedIdentityProvenance(
                Sources: new[]
                {
                    new IdentitySourceEvidence(
                        Url: "https://example.com",
                        Publisher: "pub",
                        SourceTrust: IdentitySourceTrust.Trusted,
                        MintLinkStatus: IdentityMintLinkStatus.ReferencesCompetingMint,
                        ReferencedRelevantMints: new[] { "CompetingMint2222222222222222222222222222" },
                        EvidenceSummary: "Trusted index references competing mint")
                },
                Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            CompetingMintChronologies: null,
            IdentityClassification: new TokenIdentityClassification(
                Classification: classificationType,
                Confidence: TokenIdentityClassificationConfidence.Medium,
                RelevantCompetingMint: "CompetingMint2222222222222222222222222222",
                Evidence: new[]
                {
                    TokenIdentityClassificationEvidence.SameNormalizedName,
                    TokenIdentityClassificationEvidence.SameNormalizedSymbol,
                    TokenIdentityClassificationEvidence.CompetingMintObserved,
                    TokenIdentityClassificationEvidence.TrustedSourceReferencesCompetingMint
                },
                Limitations: new[]
                {
                    TokenIdentityClassificationLimitation.CopyingIntentNotProven,
                    TokenIdentityClassificationLimitation.GlobalFirstTokenNotProven,
                    TokenIdentityClassificationLimitation.ProviderHistoryMayBeIncomplete,
                    TokenIdentityClassificationLimitation.SocialContextNotAnalyzed
                }));
    }
}