using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Infrastructure.Gemini;

namespace TrainRekt.Api.Tests;

public sealed class GeminiCandidateMapperTests
{
    [Fact]
    public void MapStructuredJson_ValidPayload_MapsCandidate()
    {
        var mapper = CreateMapper();

        var json = $$"""
        {
          "identityEvidence": [
            {
              "evidenceType": "MintAddressMentioned",
              "value": "{{ProtocolConstants.SolanaMobileSkrMint}}",
              "note": "observed"
            }
          ],
          "sources": [
            {
              "sourceId": "src-1",
              "url": "https://docs.example.com/tokenomics",
              "title": "Docs",
              "publisher": "Example",
              "claimedSourceType": "OfficialDocumentation",
              "claimedCanonicalWebsite": true,
              "publishedAtUtc": null
            }
          ],
          "claims": [
            {
              "claimId": "{{ResearchClaimIds.DocumentedInflationaryIssuance}}",
              "category": "issuance",
              "statement": "Issuance is documented.",
              "sourceIds": ["src-1"],
              "extractionNote": "doc quote",
              "observedFactReferences": [
                {
                  "factId": "{{ObservedFactIds.MintAuthorityActive}}",
                  "observedValue": "true",
                  "expectedValue": null,
                  "note": "from docs"
                }
              ]
            }
          ]
        }
        """;

        var result = mapper.MapStructuredJson(json);

        Assert.True(result.Success);
        Assert.NotNull(result.Value);
        Assert.Single(result.Value!.Sources);
        Assert.Single(result.Value.Claims);
    }

    [Fact]
    public void MapStructuredJson_MalformedJson_ReturnsMalformedResponse()
    {
        var mapper = CreateMapper();

        var result = mapper.MapStructuredJson("{not-json");

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.MalformedResponse, result.FailureReason);
    }

    [Fact]
    public void MapStructuredJson_ForbiddenAuthoritativeField_ReturnsSchemaViolation()
    {
        var mapper = CreateMapper();

        const string json = "{" +
            "\"identityEvidence\":[]," +
            "\"sources\":[]," +
            "\"claims\":[{\"claimId\":\"DOCUMENTED_INFLATIONARY_ISSUANCE\",\"category\":\"issuance\",\"statement\":\"x\",\"sourceIds\":[\"s\"],\"VerificationStatus\":\"Verified\"}]" +
            "}";

        var result = mapper.MapStructuredJson(json);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.SchemaViolation, result.FailureReason);
    }

      [Fact]
      public void MapStructuredJson_AttemptedConfirmedIdentityField_ReturnsSchemaViolation()
      {
        var mapper = CreateMapper();

        const string json = "{" +
          "\"researchIdentityMatch\":\"Confirmed\"," +
          "\"identityEvidence\":[]," +
          "\"sources\":[]," +
          "\"claims\":[]" +
          "}";

        var result = mapper.MapStructuredJson(json);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.SchemaViolation, result.FailureReason);
      }

    [Fact]
    public void MapStructuredJson_UnsupportedClaimId_IsDropped()
    {
        var mapper = CreateMapper();

        const string json = "{" +
            "\"identityEvidence\":[]," +
            "\"sources\":[{\"sourceId\":\"src\",\"url\":\"https://docs.example.com\",\"title\":\"t\",\"publisher\":\"p\",\"claimedSourceType\":\"ThirdParty\",\"claimedCanonicalWebsite\":false}]," +
            "\"claims\":[{\"claimId\":\"UNSUPPORTED\",\"category\":\"x\",\"statement\":\"x\",\"sourceIds\":[\"src\"]}]" +
            "}";

        var result = mapper.MapStructuredJson(json);

        Assert.True(result.Success);
        Assert.Empty(result.Value!.Claims);
    }

    [Fact]
    public void MapStructuredJson_DuplicateSourceIds_ReturnsSchemaViolation()
    {
        var mapper = CreateMapper();

        const string json = "{" +
            "\"identityEvidence\":[]," +
            "\"sources\":[" +
            "{\"sourceId\":\"src\",\"url\":\"https://docs.example.com/a\",\"title\":\"t\",\"publisher\":\"p\",\"claimedSourceType\":\"ThirdParty\",\"claimedCanonicalWebsite\":false}," +
            "{\"sourceId\":\"src\",\"url\":\"https://docs.example.com/b\",\"title\":\"t\",\"publisher\":\"p\",\"claimedSourceType\":\"ThirdParty\",\"claimedCanonicalWebsite\":false}" +
            "],\"claims\":[]}";

        var result = mapper.MapStructuredJson(json);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.SchemaViolation, result.FailureReason);
    }

    [Fact]
    public void MapStructuredJson_ClaimReferencesMissingSource_ReturnsSchemaViolation()
    {
        var mapper = CreateMapper();

        const string json = "{" +
            "\"identityEvidence\":[]," +
            "\"sources\":[{\"sourceId\":\"src\",\"url\":\"https://docs.example.com\",\"title\":\"t\",\"publisher\":\"p\",\"claimedSourceType\":\"ThirdParty\",\"claimedCanonicalWebsite\":false}]," +
            "\"claims\":[{" +
            "\"claimId\":\"DOCUMENTED_INFLATIONARY_ISSUANCE\",\"category\":\"issuance\",\"statement\":\"x\",\"sourceIds\":[\"missing\"]" +
            "}]" +
            "}";

        var result = mapper.MapStructuredJson(json);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.SchemaViolation, result.FailureReason);
    }

      [Fact]
      public void MapStructuredJson_TooManySources_ReturnsNoUsefulSources()
      {
        var mapper = new GeminiCandidateMapper(new TokenResearchOptions
        {
          MaxSources = 1,
          MaxClaims = 32,
          MaxUrlLength = 2048,
          MaxTitleLength = 160,
          MaxPublisherLength = 120
        });

        const string json = "{" +
          "\"identityEvidence\":[]," +
          "\"sources\":[" +
          "{\"sourceId\":\"src-1\",\"url\":\"https://docs.example.com/1\",\"title\":\"t\",\"publisher\":\"p\",\"claimedSourceType\":\"ThirdParty\",\"claimedCanonicalWebsite\":false}," +
          "{\"sourceId\":\"src-2\",\"url\":\"https://docs.example.com/2\",\"title\":\"t\",\"publisher\":\"p\",\"claimedSourceType\":\"ThirdParty\",\"claimedCanonicalWebsite\":false}" +
          "]," +
          "\"claims\":[]" +
          "}";

        var result = mapper.MapStructuredJson(json);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.NoUsefulSources, result.FailureReason);
      }

      [Fact]
      public void MapStructuredJson_DuplicateClaimIds_ReturnsSchemaViolation()
      {
        var mapper = CreateMapper();

        const string json = "{" +
          "\"identityEvidence\":[]," +
          "\"sources\":[{\"sourceId\":\"src\",\"url\":\"https://docs.example.com\",\"title\":\"t\",\"publisher\":\"p\",\"claimedSourceType\":\"ThirdParty\",\"claimedCanonicalWebsite\":false}]," +
          "\"claims\":[" +
          "{\"claimId\":\"DOCUMENTED_INFLATIONARY_ISSUANCE\",\"category\":\"issuance\",\"statement\":\"x\",\"sourceIds\":[\"src\"]}," +
          "{\"claimId\":\"DOCUMENTED_INFLATIONARY_ISSUANCE\",\"category\":\"issuance\",\"statement\":\"x\",\"sourceIds\":[\"src\"]}" +
          "]" +
          "}";

        var result = mapper.MapStructuredJson(json);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.SchemaViolation, result.FailureReason);
      }

    private static GeminiCandidateMapper CreateMapper()
    {
        return new GeminiCandidateMapper(new TokenResearchOptions
        {
            MaxSources = 16,
            MaxClaims = 32,
            MaxUrlLength = 2048,
            MaxTitleLength = 160,
            MaxPublisherLength = 120
        });
    }
}
