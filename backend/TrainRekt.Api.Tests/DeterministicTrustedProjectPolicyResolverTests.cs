using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Tests;

public sealed class DeterministicTrustedProjectPolicyResolverTests
{
    private const string JupiterMint = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

    [Fact]
    public void Resolve_JupiterMetadataHost_ResolvesJupiterPolicy()
    {
        var resolver = new DeterministicTrustedProjectPolicyResolver(
            new TrustedProjectSourcePolicyRegistry(),
            new TrustedMintSourceRegistry());

        var policy = resolver.Resolve(JupiterMint, "https://station.jup.ag/guides/token-list");

        Assert.NotNull(policy);
        Assert.Equal("jupiter", policy!.ProjectKey);
    }

    [Fact]
    public void Resolve_JupSymbolAloneDoesNotResolve()
    {
        var resolver = new DeterministicTrustedProjectPolicyResolver(
            new TrustedProjectSourcePolicyRegistry(),
            new TrustedMintSourceRegistry());

        var policy = resolver.Resolve(JupiterMint, null);

        Assert.Null(policy);
    }

    [Fact]
    public void Resolve_UnknownProject_FailsClosed()
    {
        var resolver = new DeterministicTrustedProjectPolicyResolver(
            new TrustedProjectSourcePolicyRegistry(),
            new TrustedMintSourceRegistry());

        var policy = resolver.Resolve("So11111111111111111111111111111111111111112", "https://unknown.example/project");

        Assert.Null(policy);
    }

    [Fact]
    public void Resolve_SkrWithoutMetadata_UsesLegacyFallback()
    {
        var resolver = new DeterministicTrustedProjectPolicyResolver(
            new TrustedProjectSourcePolicyRegistry(),
            new TrustedMintSourceRegistry());

        var policy = resolver.Resolve(ProtocolConstants.SolanaMobileSkrMint, null);

        Assert.NotNull(policy);
        Assert.Equal(ProtocolConstants.SolanaMobileSkrProtocolName, policy!.ProjectKey);
    }
}
