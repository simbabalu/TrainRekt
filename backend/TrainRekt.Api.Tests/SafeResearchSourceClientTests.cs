using System.Net;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Infrastructure.Research;

namespace TrainRekt.Api.Tests;

public sealed class SafeResearchSourceClientTests
{
    [Fact]
    public async Task FetchAsync_AttachesEndpointPinningMetadata()
    {
        ResearchPinnedEndpoint? captured = null;

        var handler = new RoutingHttpMessageHandler((request, _) =>
        {
            request.Options.TryGetValue(ResearchEndpointPinning.RequestOptionKey, out captured);
            return Task.FromResult(ResearchSecurityTestFactory.TextResponse(HttpStatusCode.OK, "text/plain", "ok"));
        });

        var client = ResearchSecurityTestFactory.CreateSafeClient(handler, new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = new[]
            {
                IPAddress.Parse("93.184.216.34"),
                IPAddress.Parse("93.184.216.35")
            }
        });

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(captured);
        Assert.Equal("public.example", captured!.Host);
        Assert.Equal(443, captured.Port);
        Assert.Equal(2, captured.AllowedAddresses.Count);
    }

    [Fact]
    public async Task FetchAsync_PublicToPrivateRedirect_IsRejected()
    {
        var handler = new RoutingHttpMessageHandler((request, _) =>
        {
            if (request.RequestUri!.Host == "public.example")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
                {
                    Headers =
                    {
                        Location = new Uri("https://10.0.0.5/data")
                    }
                });
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });

        var client = ResearchSecurityTestFactory.CreateSafeClient(handler, new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") }
        });

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.True(result.Reason is ResearchSourceAssessmentReason.PrivateNetworkTarget or ResearchSourceAssessmentReason.DnsResolutionRejected);
    }

    [Fact]
    public async Task FetchAsync_PublicToLocalhostRedirect_IsRejected()
    {
        var handler = new RoutingHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
            {
                Headers =
                {
                    Location = new Uri("https://localhost/path")
                }
            }));

        var client = ResearchSecurityTestFactory.CreateSafeClient(handler, new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") }
        });

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.PrivateNetworkTarget, result.Reason);
    }

    [Fact]
    public async Task FetchAsync_PublicToNonHttpsRedirect_IsRejected()
    {
        var handler = new RoutingHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
            {
                Headers =
                {
                    Location = new Uri("http://public.example/next")
                }
            }));

        var client = ResearchSecurityTestFactory.CreateSafeClient(handler, new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") }
        });

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.UnsupportedScheme, result.Reason);
    }

    [Fact]
    public async Task FetchAsync_PublicToUnexpectedPortRedirect_IsRejected()
    {
        var handler = new RoutingHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
            {
                Headers =
                {
                    Location = new Uri("https://public.example:444/next")
                }
            }));

        var client = ResearchSecurityTestFactory.CreateSafeClient(handler, new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") }
        });

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.UnsupportedPort, result.Reason);
    }

    [Fact]
    public async Task FetchAsync_TooManyRedirects_IsRejected()
    {
        var handler = new RoutingHttpMessageHandler((request, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
            {
                Headers =
                {
                    Location = new Uri($"https://public.example/{Guid.NewGuid():N}")
                }
            }));

        var client = ResearchSecurityTestFactory.CreateSafeClient(
            handler,
            new Dictionary<string, IReadOnlyList<IPAddress>> { ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") } },
            options => options.MaxRedirects = 3);

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.TooManyRedirects, result.Reason);
    }

    [Fact]
    public async Task FetchAsync_ValidPublicRedirect_Succeeds()
    {
        var handler = new RoutingHttpMessageHandler((request, _) =>
        {
            if (request.RequestUri!.AbsolutePath == "/start")
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
                {
                    Headers =
                    {
                        Location = new Uri("https://public.example/final")
                    }
                });
            }

            return Task.FromResult(ResearchSecurityTestFactory.TextResponse(HttpStatusCode.OK, "text/plain", "hello"));
        });

        var client = ResearchSecurityTestFactory.CreateSafeClient(handler, new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") }
        });

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("hello", result.Content);
    }

    [Fact]
    public async Task FetchAsync_Timeout_IsRejected()
    {
        var handler = new RoutingHttpMessageHandler(async (_, cancellationToken) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var client = ResearchSecurityTestFactory.CreateSafeClient(
            handler,
            new Dictionary<string, IReadOnlyList<IPAddress>> { ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") } },
            options => options.SourceTimeoutSeconds = 1);

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.Timeout, result.Reason);
    }

    [Fact]
    public async Task FetchAsync_ContentLengthTooLarge_IsRejected()
    {
        var response = ResearchSecurityTestFactory.TextResponse(HttpStatusCode.OK, "text/plain", "tiny");
        response.Content.Headers.ContentLength = 2_000_000;

        var handler = new RoutingHttpMessageHandler((_, _) => Task.FromResult(response));
        var client = ResearchSecurityTestFactory.CreateSafeClient(
            handler,
            new Dictionary<string, IReadOnlyList<IPAddress>> { ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") } },
            options => options.MaxResponseBytes = 1024);

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.ResponseTooLarge, result.Reason);
    }

    [Fact]
    public async Task FetchAsync_StreamingBodyTooLarge_IsRejected()
    {
        var body = new string('x', 2048);
        var response = ResearchSecurityTestFactory.TextResponse(HttpStatusCode.OK, "text/plain", body);
        response.Content.Headers.ContentLength = null;

        var handler = new RoutingHttpMessageHandler((_, _) => Task.FromResult(response));
        var client = ResearchSecurityTestFactory.CreateSafeClient(
            handler,
            new Dictionary<string, IReadOnlyList<IPAddress>> { ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") } },
            options => options.MaxResponseBytes = 1024);

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.ResponseTooLarge, result.Reason);
    }

    [Fact]
    public async Task FetchAsync_UnsupportedContentType_IsRejected()
    {
        var handler = new RoutingHttpMessageHandler((_, _) =>
            Task.FromResult(ResearchSecurityTestFactory.TextResponse(HttpStatusCode.OK, "application/pdf", "pdf")));

        var client = ResearchSecurityTestFactory.CreateSafeClient(handler, new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") }
        });

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.UnsupportedContentType, result.Reason);
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task FetchAsync_HttpErrorStatus_IsRejected(HttpStatusCode statusCode)
    {
        var handler = new RoutingHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(statusCode)));

        var client = ResearchSecurityTestFactory.CreateSafeClient(handler, new Dictionary<string, IReadOnlyList<IPAddress>>
        {
            ["public.example"] = new[] { IPAddress.Parse("93.184.216.34") }
        });

        var result = await client.FetchAsync(ResearchSecurityTestFactory.Source("https://public.example/start"), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ResearchSourceAssessmentReason.HttpNotSuccessful, result.Reason);
    }
}
