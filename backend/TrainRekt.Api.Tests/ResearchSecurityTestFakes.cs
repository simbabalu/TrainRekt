using System.Net;
using System.Net.Http.Headers;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Infrastructure.Research;

namespace TrainRekt.Api.Tests;

internal sealed class FakeResearchDnsResolver : IResearchDnsResolver
{
    private readonly Dictionary<string, IReadOnlyList<IPAddress>> _answers;

    public FakeResearchDnsResolver(Dictionary<string, IReadOnlyList<IPAddress>> answers)
    {
        _answers = answers;
    }

    public Task<IReadOnlyList<IPAddress>> ResolveAsync(string host, CancellationToken cancellationToken)
    {
        if (_answers.TryGetValue(host, out var result))
        {
            return Task.FromResult(result);
        }

        return Task.FromResult<IReadOnlyList<IPAddress>>(new[] { IPAddress.Parse("93.184.216.34") });
    }
}

internal sealed class StubSafeResearchSourceClient : ISafeResearchSourceClient
{
    private readonly Func<CandidateResearchSource, SafeSourceFetchResult> _handler;

    public StubSafeResearchSourceClient(Func<CandidateResearchSource, SafeSourceFetchResult> handler)
    {
        _handler = handler;
    }

    public Task<SafeSourceFetchResult> FetchAsync(CandidateResearchSource candidateSource, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(_handler(candidateSource));
    }
}

internal sealed class RoutingHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _handler;

    public RoutingHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler)
    {
        _handler = handler;
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        return _handler(request, cancellationToken);
    }
}

internal static class ResearchSecurityTestFactory
{
    public static ResearchUrlSafetyPolicy CreatePolicy(
        Dictionary<string, IReadOnlyList<IPAddress>> dnsAnswers,
        int[]? allowedPorts = null)
    {
        var options = Options.Create(new TokenResearchOptions
        {
            AllowedHttpsPorts = allowedPorts ?? new[] { 443 }
        });

        return new ResearchUrlSafetyPolicy(new FakeResearchDnsResolver(dnsAnswers), options);
    }

    public static SafeResearchSourceClient CreateSafeClient(
        HttpMessageHandler handler,
        Dictionary<string, IReadOnlyList<IPAddress>> dnsAnswers,
        Action<TokenResearchOptions>? configure = null)
    {
        var options = new TokenResearchOptions
        {
            AllowedHttpsPorts = new[] { 443 },
            SourceTimeoutSeconds = 2,
            MaxRedirects = 3,
            MaxResponseBytes = 1_048_576
        };

        configure?.Invoke(options);

        var policy = new ResearchUrlSafetyPolicy(new FakeResearchDnsResolver(dnsAnswers), Options.Create(options));
        var client = new HttpClient(handler);

        return new SafeResearchSourceClient(
            client,
            policy,
            Options.Create(options),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<SafeResearchSourceClient>.Instance);
    }

    public static CandidateResearchSource Source(string url, string id = "src")
    {
        return new CandidateResearchSource(
            Id: id,
            ClaimedSourceType: TrainRekt.Api.Domain.Models.ResearchSourceType.OfficialDocumentation,
            Title: "Candidate",
            Publisher: "Provider",
            Url: url,
            ClaimedCanonicalProjectWebsite: true,
            PublishedAtUtc: null);
    }

    public static HttpResponseMessage TextResponse(HttpStatusCode statusCode, string contentType, string body)
    {
        return new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(body)
            {
                Headers =
                {
                    ContentType = new MediaTypeHeaderValue(contentType)
                }
            }
        };
    }
}
