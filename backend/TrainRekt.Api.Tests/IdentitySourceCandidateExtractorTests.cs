using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class IdentitySourceCandidateExtractorTests
{
    [Fact]
    public void Extract_WithResolvedProjectPolicy_SeedsTrustedCandidates()
    {
        var extractor = new IdentitySourceCandidateExtractor(new TrustedMintSourceRegistry());
        var policy = new TrustedProjectSourcePolicyRegistry()
            .List()
            .Single(entry => entry.ProjectKey == "jupiter");

        var candidates = extractor.Extract(
            scannedMint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
            metadataUri: "https://station.jup.ag/guides/token-list",
            maxSources: 4,
            resolvedProjectPolicy: policy);

        Assert.Contains(candidates, candidate =>
            candidate.InitialTrust == IdentitySourceTrust.Trusted
            && candidate.Url == "https://docs.jup.ag/");
    }

    [Fact]
    public void Extract_SkrMintWithoutProjectPolicy_KeepsLegacyRegistryCandidates()
    {
        var extractor = new IdentitySourceCandidateExtractor(new TrustedMintSourceRegistry());

        var candidates = extractor.Extract(
            scannedMint: ProtocolConstants.SolanaMobileSkrMint,
            metadataUri: null,
            maxSources: 4,
            resolvedProjectPolicy: null);

        Assert.Contains(candidates, candidate =>
            candidate.InitialTrust == IdentitySourceTrust.Trusted
            && candidate.Url == "https://docs.solanamobile.com/solana-mobile-stack/skr");
    }
}
