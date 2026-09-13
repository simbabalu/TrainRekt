using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Tests;

public sealed class ResearchContentNormalizerTests
{
    [Fact]
    public void Normalize_HtmlScriptMintOnly_DoesNotProduceExactMatch()
    {
        var normalizer = new ResearchContentNormalizer();
        var matcher = new SolanaMintEvidenceMatcher();

        var normalized = normalizer.Normalize("text/html", $"<html><script>const mint='{ProtocolConstants.SolanaMobileSkrMint}'</script><body>hello</body></html>");
        var match = matcher.Match(ProtocolConstants.SolanaMobileSkrMint, normalized.Text ?? string.Empty, normalized.JsonMintFieldValues);

        Assert.True(normalized.Success);
        Assert.False(match.HasExactMintMatch);
    }

    [Fact]
    public void Normalize_HtmlStyleMintOnly_DoesNotProduceExactMatch()
    {
        var normalizer = new ResearchContentNormalizer();
        var matcher = new SolanaMintEvidenceMatcher();

        var normalized = normalizer.Normalize("text/html", $"<style>.x::before{{content:'{ProtocolConstants.SolanaMobileSkrMint}'}}</style><div>hello</div>");
        var match = matcher.Match(ProtocolConstants.SolanaMobileSkrMint, normalized.Text ?? string.Empty, normalized.JsonMintFieldValues);

        Assert.True(normalized.Success);
        Assert.False(match.HasExactMintMatch);
    }

    [Fact]
    public void Normalize_HtmlAttributeMintOnly_DoesNotProduceExactMatch()
    {
        var normalizer = new ResearchContentNormalizer();
        var matcher = new SolanaMintEvidenceMatcher();

        var normalized = normalizer.Normalize("text/html", $"<a href='https://example.com/{ProtocolConstants.SolanaMobileSkrMint}'>link</a>");
        var match = matcher.Match(ProtocolConstants.SolanaMobileSkrMint, normalized.Text ?? string.Empty, normalized.JsonMintFieldValues);

        Assert.True(normalized.Success);
        Assert.False(match.HasExactMintMatch);
    }

    [Fact]
    public void Normalize_HtmlVisibleMint_ProducesExactMatch()
    {
        var normalizer = new ResearchContentNormalizer();
        var matcher = new SolanaMintEvidenceMatcher();

        var normalized = normalizer.Normalize("text/html", $"<div>Mint: {ProtocolConstants.SolanaMobileSkrMint}</div>");
        var match = matcher.Match(ProtocolConstants.SolanaMobileSkrMint, normalized.Text ?? string.Empty, normalized.JsonMintFieldValues);

        Assert.True(normalized.Success);
        Assert.True(match.HasExactMintMatch);
    }

    [Fact]
    public void Normalize_HtmlMalformedStillExtractsVisibleText()
    {
        var normalizer = new ResearchContentNormalizer();

        var normalized = normalizer.Normalize("text/html", $"<div>Mint {ProtocolConstants.SolanaMobileSkrMint}<span");

        Assert.True(normalized.Success);
        Assert.Contains(ProtocolConstants.SolanaMobileSkrMint, normalized.Text);
    }

    [Fact]
    public void Normalize_HtmlEntities_AreDecoded()
    {
        var normalizer = new ResearchContentNormalizer();

        var normalized = normalizer.Normalize("text/html", "<p>A &amp; B</p>");

        Assert.True(normalized.Success);
        Assert.Equal("A & B", normalized.Text);
    }
}
