using System.Net;
using TrainRekt.Api.Application.Research;

namespace TrainRekt.Api.Tests;

public sealed class ResearchUrlSafetyPolicyTests
{
    [Theory]
    [InlineData("https://localhost/x")]
    [InlineData("https://127.0.0.1/x")]
    [InlineData("https://10.1.2.3/x")]
    [InlineData("https://172.16.1.1/x")]
    [InlineData("https://192.168.1.1/x")]
    [InlineData("https://169.254.1.1/x")]
    [InlineData("https://[::1]/x")]
    [InlineData("https://[fc00::1]/x")]
    [InlineData("https://[fe80::1]/x")]
    public async Task ValidateAsync_PrivateOrLoopbackTargets_AreRejected(string url)
    {
        var policy = ResearchSecurityTestFactory.CreatePolicy(new Dictionary<string, IReadOnlyList<IPAddress>>());

        var result = await policy.ValidateAsync(new Uri(url), CancellationToken.None);

        Assert.False(result.IsAllowed);
        Assert.True(result.Reason is ResearchSourceAssessmentReason.PrivateNetworkTarget or ResearchSourceAssessmentReason.DnsResolutionRejected);
    }

    [Fact]
    public async Task ValidateAsync_MixedPublicAndPrivateDnsAnswers_AreRejectedFailClosed()
    {
        var policy = ResearchSecurityTestFactory.CreatePolicy(new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["mixed.example"] = new[]
            {
                IPAddress.Parse("93.184.216.34"),
                IPAddress.Parse("10.0.0.1")
            }
        });

        var result = await policy.ValidateAsync(new Uri("https://mixed.example/path"), CancellationToken.None);

        Assert.False(result.IsAllowed);
        Assert.Equal(ResearchSourceAssessmentReason.DnsResolutionRejected, result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_NonHttps_IsRejected()
    {
        var policy = ResearchSecurityTestFactory.CreatePolicy(new Dictionary<string, IReadOnlyList<IPAddress>>());

        var result = await policy.ValidateAsync(new Uri("http://example.com/path"), CancellationToken.None);

        Assert.False(result.IsAllowed);
        Assert.Equal(ResearchSourceAssessmentReason.UnsupportedScheme, result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_UserInfo_IsRejected()
    {
        var policy = ResearchSecurityTestFactory.CreatePolicy(new Dictionary<string, IReadOnlyList<IPAddress>>());

        var result = await policy.ValidateAsync(new Uri("https://user:pass@example.com/path"), CancellationToken.None);

        Assert.False(result.IsAllowed);
        Assert.Equal(ResearchSourceAssessmentReason.UrlContainsCredentials, result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_PortNotAllowed_IsRejected()
    {
        var policy = ResearchSecurityTestFactory.CreatePolicy(new Dictionary<string, IReadOnlyList<IPAddress>>(), allowedPorts: new[] { 443 });

        var result = await policy.ValidateAsync(new Uri("https://example.com:444/path"), CancellationToken.None);

        Assert.False(result.IsAllowed);
        Assert.Equal(ResearchSourceAssessmentReason.UnsupportedPort, result.Reason);
    }

    [Fact]
    public async Task ValidateAsync_PublicHost_ResolvesAndReturnsAllowedAddresses()
    {
        var expected = new[]
        {
            IPAddress.Parse("93.184.216.34"),
            IPAddress.Parse("93.184.216.35")
        };

        var policy = ResearchSecurityTestFactory.CreatePolicy(new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = expected
        });

        var result = await policy.ValidateAsync(new Uri("https://public.example/path"), CancellationToken.None);

        Assert.True(result.IsAllowed);
        Assert.NotNull(result.NormalizedUri);
        Assert.Equal("public.example", result.NormalizedHost);
        Assert.Equal(expected, result.ResolvedAddresses);
    }

    [Fact]
    public async Task ValidateAsync_PublicIpTarget_ReturnsPinnedAddress()
    {
        var policy = ResearchSecurityTestFactory.CreatePolicy(new Dictionary<string, IReadOnlyList<IPAddress>>());

        var result = await policy.ValidateAsync(new Uri("https://93.184.216.34/path"), CancellationToken.None);

        Assert.True(result.IsAllowed);
        Assert.Single(result.ResolvedAddresses);
        Assert.Equal(IPAddress.Parse("93.184.216.34"), result.ResolvedAddresses[0]);
    }
}
