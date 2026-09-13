using TrainRekt.Api.Application.Services;

namespace TrainRekt.Api.Tests;

public sealed class TokenIdentityNormalizerTests
{
    private readonly TokenIdentityNormalizer _normalizer = new();

    [Fact]
    public void NormalizeName_RemovesUrlLikeContentAndCollapsesWhitespace()
    {
        var value = _normalizer.NormalizeName("  Rocket  Coin https://example.com/path  ");

        Assert.Equal("rocket coin", value);
    }

    [Fact]
    public void NormalizeName_UsesUnicodeCompatibilityNormalization()
    {
        var value = _normalizer.NormalizeName("Ａｌｐｈａ   Token");

        Assert.Equal("alpha token", value);
    }

    [Fact]
    public void NormalizeSymbol_RemovesLeadingDollarAndPunctuation()
    {
        var value = _normalizer.NormalizeSymbol(" $R-CH!!! ");

        Assert.Equal("rch", value);
    }

    [Fact]
    public void NormalizeSymbol_AllWhitespace_ReturnsNull()
    {
        var value = _normalizer.NormalizeSymbol("   ");

        Assert.Null(value);
    }
}
