using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Infrastructure.Gemini;

namespace TrainRekt.Api.Tests;

public sealed class GeminiInteractionClientTests
{
    [Fact]
    public async Task RunGroundedResearchAsync_ValidGroundedResponse_ReturnsNormalizedCitations()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
        {
            var payload = """
            {
              "steps": [
                {
                  "type": "model_output",
                  "content": [
                    {
                      "type": "text",
                      "text": "grounded text",
                      "annotations": [
                        { "type": "url_citation", "url": "https://docs.example.com/x", "title": "docs" },
                        { "type": "url_citation", "url": "https://www.google.com/url?url=https%3A%2F%2Frepo.example.com%2Fa", "title": "redirect" },
                        { "type": "url_citation", "url": "http://insecure.example.com", "title": "insecure" }
                      ]
                    }
                  ]
                }
              ]
            }
            """;

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            });
        });

        var client = CreateClient(handler);

        var result = await client.RunGroundedResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(result.Value);
        Assert.Equal("grounded text", result.Value!.Text);
        Assert.Equal(2, result.Value.Sources.Count);
        Assert.Contains(result.Value.Sources, source => source.Url == "https://docs.example.com/x");
        Assert.Contains(result.Value.Sources, source => source.Url == "https://repo.example.com/a");
    }

    [Fact]
    public async Task RunGroundedResearchAsync_NoCitations_ReturnsGroundingUnavailable()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"steps\":[{\"type\":\"model_output\",\"content\":[{\"type\":\"text\",\"text\":\"no citations\"}]}]}", Encoding.UTF8, "application/json")
            }));

        var client = CreateClient(handler);

        var result = await client.RunGroundedResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.GroundingUnavailable, result.FailureReason);
    }

    [Fact]
    public async Task RunGroundedResearchAsync_Http429_ReturnsRateLimited()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.TooManyRequests)));
        var client = CreateClient(handler);

        var result = await client.RunGroundedResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.RateLimited, result.FailureReason);
    }

    [Fact]
    public async Task RunGroundedResearchAsync_Http500_ReturnsProviderUnavailable()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError)));
        var client = CreateClient(handler);

        var result = await client.RunGroundedResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.ProviderUnavailable, result.FailureReason);
    }

    [Fact]
    public async Task RunGroundedResearchAsync_Timeout_ReturnsTimeout()
    {
        var handler = new StubHttpMessageHandler(async (_, cancellationToken) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var client = CreateClient(handler, configure: options => options.TimeoutSeconds = 1);

        var result = await client.RunGroundedResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.Timeout, result.FailureReason);
    }

    [Fact]
    public async Task RunStructuredExtractionAsync_ValidModelOutput_ReturnsJsonText()
    {
        var handler = new StubHttpMessageHandler(async (request, _) =>
        {
            var requestBody = await request.Content!.ReadAsStringAsync();
            Assert.DoesNotContain("google_search", requestBody, StringComparison.OrdinalIgnoreCase);

            const string payload = "{\"steps\":[{\"type\":\"model_output\",\"content\":[{\"type\":\"text\",\"text\":\"{\\\"identityEvidence\\\":[],\\\"sources\\\":[],\\\"claims\\\":[]}\"}]}]}";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
        });

        var client = CreateClient(handler);
        var grounded = new GeminiGroundedResearch("research text", new[]
        {
            new GeminiCitation("https://docs.example.com", "docs")
        });

        var result = await client.RunStructuredExtractionAsync(CreateRequest(), grounded, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Contains("identityEvidence", result.Value);
    }

    [Fact]
    public async Task RunStructuredExtractionAsync_MalformedApiPayload_ReturnsMalformedResponse()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("not-json", Encoding.UTF8, "application/json")
        }));

        var client = CreateClient(handler);
        var grounded = new GeminiGroundedResearch("research text", new[] { new GeminiCitation("https://docs.example.com", "docs") });

        var result = await client.RunStructuredExtractionAsync(CreateRequest(), grounded, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.MalformedResponse, result.FailureReason);
    }

    private static ResearchRequest CreateRequest()
    {
        return new ResearchRequest(
            Mint: "So11111111111111111111111111111111111111112",
            TokenName: "SOL",
            TokenSymbol: "SOL",
            TokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            Authorities: new TokenAuthorities("mint-auth", false, "freeze-auth", false),
            ClassifiedProtocols: new[] { "sample-protocol" },
            Needs: new[]
            {
                new ResearchNeed(
                    "ACTIVE_MINT_AUTHORITY_WITHOUT_CONTEXT",
                    ResearchNeedCategory.ActiveMintAuthorityWithoutContext,
                    ResearchNeedPriority.High,
                    Array.Empty<ObservedFactReference>(),
                    "reason")
            },
            ExistingSourceIds: Array.Empty<string>(),
            ExistingClaimIds: Array.Empty<string>());
    }

    private static GeminiInteractionClient CreateClient(
        HttpMessageHandler handler,
        Action<GeminiOptions>? configure = null)
    {
        var options = new GeminiOptions
        {
            Enabled = true,
            ApiKey = "test-key",
            BaseUrl = "https://generativelanguage.googleapis.com",
            Model = "gemini-2.5-flash-lite",
            TimeoutSeconds = 15,
            MaxResponseBytes = 524288
        };

        configure?.Invoke(options);

        return new GeminiInteractionClient(
            new HttpClient(handler) { BaseAddress = new Uri(options.BaseUrl) },
            Options.Create(options),
            new GeminiGroundingNormalizer(),
            NullLogger<GeminiInteractionClient>.Instance);
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return _handler(request, cancellationToken);
        }
    }
}
