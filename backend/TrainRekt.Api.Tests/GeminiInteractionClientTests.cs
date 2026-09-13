using System.Net;
using System.Text;
using System.Text.Json;
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
    public async Task RunGroundedResearchAsync_RequestSchema_UsesInteractionsToolsAndNoLegacyFields()
    {
        var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("/v1beta/interactions", request.RequestUri!.AbsolutePath);
            Assert.True(request.Headers.Contains("x-goog-api-key"));

            var body = await request.Content!.ReadAsStringAsync();
            using var json = JsonDocument.Parse(body);
            var root = json.RootElement;

            Assert.Equal("gemini-2.5-flash-lite", root.GetProperty("model").GetString());
            Assert.True(root.TryGetProperty("input", out var inputElement));
            Assert.Equal(JsonValueKind.String, inputElement.ValueKind);

            var tools = root.GetProperty("tools");
            Assert.Equal(JsonValueKind.Array, tools.ValueKind);
            var tool = Assert.Single(tools.EnumerateArray());
            Assert.Equal("google_search", tool.GetProperty("type").GetString());

            Assert.False(root.TryGetProperty("response_mime_type", out _));
            Assert.False(root.TryGetProperty("outputs", out _));

            var generationConfig = root.GetProperty("generation_config");
            Assert.True(generationConfig.TryGetProperty("max_output_tokens", out _));
            Assert.False(generationConfig.TryGetProperty("thinking_level", out _));

            const string payload = "{\"steps\":[{\"type\":\"model_output\",\"content\":[{\"type\":\"text\",\"text\":\"grounded\",\"annotations\":[{\"type\":\"url_citation\",\"url\":\"https://docs.example.com/a\"}]}]}]}";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
        });

        var client = CreateClient(handler);

        var result = await client.RunGroundedResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.True(result.Success);
    }

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
    public async Task RunGroundedResearchAsync_ParsesGoogleSearchResultStepAndDeduplicates()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
        {
            const string payload = "{" +
                "\"steps\":[" +
                "{\"type\":\"google_search_call\",\"query\":\"skr mint\"}," +
                "{\"type\":\"google_search_result\",\"results\":[" +
                "{\"url\":\"https://www.google.com/url?url=https%3A%2F%2Frepo.example.com%2Fa\",\"title\":\"redirect\"}," +
                "{\"url\":\"https://repo.example.com/a\",\"title\":\"direct\"}" +
                "]}," +
                "{\"type\":\"model_output\",\"content\":[{\"type\":\"text\",\"text\":\"grounded text\"}]}" +
                "]}";

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            });
        });

        var client = CreateClient(handler);

        var result = await client.RunGroundedResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Single(result.Value!.Sources);
        Assert.Equal("https://repo.example.com/a", result.Value.Sources[0].Url);
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
    public async Task RunStructuredExtractionAsync_RequestSchema_UsesResponseFormatSchemaAndNoLegacyFields()
    {
        var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("/v1beta/interactions", request.RequestUri!.AbsolutePath);

            var body = await request.Content!.ReadAsStringAsync();
            using var json = JsonDocument.Parse(body);
            var root = json.RootElement;

            Assert.Equal("gemini-2.5-flash-lite", root.GetProperty("model").GetString());
            Assert.False(root.TryGetProperty("tools", out _));
            Assert.False(root.TryGetProperty("response_mime_type", out _));
            Assert.False(root.TryGetProperty("outputs", out _));

            var responseFormat = root.GetProperty("response_format");
            Assert.Equal("text", responseFormat.GetProperty("type").GetString());
            Assert.Equal("application/json", responseFormat.GetProperty("mime_type").GetString());
            Assert.Equal(JsonValueKind.Object, responseFormat.GetProperty("schema").ValueKind);

            const string payload = "{\"steps\":[{\"type\":\"model_output\",\"content\":[{\"type\":\"text\",\"text\":\"{\\\"identityEvidence\\\":[],\\\"sources\\\":[],\\\"claims\\\":[]}\"}]}]}";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
        });

        var client = CreateClient(handler);
        var grounded = new GeminiGroundedResearch("grounded", new[]
        {
            new GeminiCitation("https://docs.example.com", "docs")
        });

        var result = await client.RunStructuredExtractionAsync(CreateRequest(), grounded, CancellationToken.None);

        Assert.True(result.Success);
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

    [Fact]
    public async Task RunGroundedResearchAsync_Http400_UsesSanitizedGoogleErrorDetail()
    {
        var oversized = new string('x', 1200);
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent(
                "{" +
                "\"error\":{" +
                "\"code\":400," +
                "\"status\":\"INVALID_ARGUMENT\"," +
                "\"message\":\"bad field in request: " + oversized + "\"}" +
                "}",
                Encoding.UTF8,
                "application/json")
        }));

        var client = CreateClient(handler);
        var result = await client.RunGroundedResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(GeminiFailureReason.ProviderRejected, result.FailureReason);
        Assert.Equal(400, result.HttpStatusCode);
        Assert.NotNull(result.Detail);
        Assert.Contains("http=400", result.Detail, StringComparison.Ordinal);
        Assert.Contains("error_type=INVALID_ARGUMENT", result.Detail, StringComparison.Ordinal);
        Assert.DoesNotContain("test-key", result.Detail, StringComparison.Ordinal);
        Assert.DoesNotContain("Mint=So11111111111111111111111111111111111111112", result.Detail, StringComparison.Ordinal);
        Assert.True(result.Detail.Length <= 420);
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
