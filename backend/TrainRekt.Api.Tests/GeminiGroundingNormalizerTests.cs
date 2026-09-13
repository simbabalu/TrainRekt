using TrainRekt.Api.Infrastructure.Gemini;

namespace TrainRekt.Api.Tests;

public sealed class GeminiGroundingNormalizerTests
{
    [Fact]
    public void Normalize_VertexPathRedirectWithoutTargetMetadata_IsRetainedAsHttpsUrl()
    {
        var normalizer = new GeminiGroundingNormalizer();
        var citations = new[]
        {
            new GeminiCitation("https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABC123", "redirect")
        };

        var normalized = normalizer.Normalize(citations);

        var source = Assert.Single(normalized);
        Assert.Equal("https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABC123", source.Url);
    }

    [Fact]
    public void Normalize_GoogleUrlQueryRedirect_UnwrapsToTargetUrl()
    {
        var normalizer = new GeminiGroundingNormalizer();
        var citations = new[]
        {
            new GeminiCitation("https://www.google.com/url?url=https%3A%2F%2Fdocs.example.com%2Fskr", "redirect")
        };

        var normalized = normalizer.Normalize(citations);

        var source = Assert.Single(normalized);
        Assert.Equal("https://docs.example.com/skr", source.Url);
    }
}
