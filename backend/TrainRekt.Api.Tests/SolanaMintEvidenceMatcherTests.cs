using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Tests;

public sealed class SolanaMintEvidenceMatcherTests
{
    private const string Mint = ProtocolConstants.SolanaMobileSkrMint;

    [Fact]
    public void Match_ExactMintInText_ReturnsExactMatch()
    {
        var matcher = new SolanaMintEvidenceMatcher();

        var result = matcher.Match(Mint, $"mint is {Mint}.", Array.Empty<string>());

        Assert.True(result.HasExactMintMatch);
    }

    [Fact]
    public void Match_ExactMintInJsonValue_ReturnsExactMatch()
    {
        var matcher = new SolanaMintEvidenceMatcher();

        var result = matcher.Match(Mint, "", new[] { Mint });

        Assert.True(result.HasExactMintMatch);
    }

    [Fact]
    public void Match_SubstringDoesNotCountAsMatch()
    {
        var matcher = new SolanaMintEvidenceMatcher();

        var result = matcher.Match(Mint, $"prefix{Mint}suffix", Array.Empty<string>());

        Assert.False(result.HasExactMintMatch);
    }

    [Fact]
    public void Match_WrongMint_IsNotExactMatch()
    {
        var matcher = new SolanaMintEvidenceMatcher();
        var otherMint = "So11111111111111111111111111111111111111112";

        var result = matcher.Match(Mint, $"mint {otherMint}", Array.Empty<string>());

        Assert.False(result.HasExactMintMatch);
        Assert.True(result.HasConflictingMintEvidence);
    }

    [Fact]
    public void Match_InvalidRequestedMint_ReturnsNoMatch()
    {
        var matcher = new SolanaMintEvidenceMatcher();

        var result = matcher.Match("not-a-mint", "anything", Array.Empty<string>());

        Assert.False(result.HasExactMintMatch);
    }

    [Fact]
    public void FindRelevantMintReferences_UsesExactBoundariesAndDeduplicates()
    {
        var matcher = new SolanaMintEvidenceMatcher();
        var relevant = new[]
        {
            Mint,
            "So11111111111111111111111111111111111111112"
        };

        var text = $"prefix{Mint}suffix {Mint} and So11111111111111111111111111111111111111112";
        var result = matcher.FindRelevantMintReferences(relevant, text, Array.Empty<string>(), maxBase58Candidates: 64);

        Assert.Equal(2, result.Count);
        Assert.Contains(Mint, result);
        Assert.Contains("So11111111111111111111111111111111111111112", result);
    }

    [Fact]
    public void FindRelevantMintReferences_JsonMintValuesAreIncluded()
    {
        var matcher = new SolanaMintEvidenceMatcher();
        var relevant = new[] { Mint };

        var result = matcher.FindRelevantMintReferences(relevant, "{}", new[] { Mint }, maxBase58Candidates: 1);

        Assert.Single(result);
        Assert.Equal(Mint, result[0]);
    }
}
