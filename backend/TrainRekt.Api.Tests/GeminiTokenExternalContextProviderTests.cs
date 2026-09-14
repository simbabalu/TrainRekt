using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Gemini;

namespace TrainRekt.Api.Tests;

public sealed class GeminiTokenExternalContextProviderTests
{
    [Fact]
    public async Task ResearchAsync_RequestIsMintAnchored_AndRejectsSymbolOnlyInferenceInInstruction()
    {
        var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            var body = await request.Content!.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            var systemInstruction = root.GetProperty("system_instruction").GetString() ?? string.Empty;
            Assert.Contains("exact Solana mint address", systemInstruction, StringComparison.Ordinal);
            Assert.Contains("name-only or symbol-only evidence is insufficient", systemInstruction, StringComparison.Ordinal);

            var input = root.GetProperty("input").GetString() ?? string.Empty;
            Assert.Contains("Mint=ResearchMint1111111111111111111111111111111", input, StringComparison.Ordinal);

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(CreateModelOutput("{" +
                    "\"availability\":\"available\"," +
                    "\"assetType\":\"tokenized_stock\"," +
                    "\"projectName\":\"IssuerX\"," +
                    "\"summary\":\"Issuer documentation references this mint for tokenized equity operations.\"," +
                    "\"confidence\":\"MEDIUM\"," +
                    "\"mintConfirmed\":true," +
                    "\"ambiguousIdentity\":false," +
                    "\"evidence\":[{" +
                    "\"sourceType\":\"official_issuer_documentation\"," +
                    "\"title\":\"Issuer docs\"," +
                    "\"domain\":\"issuer.example\"," +
                    "\"claim\":\"Mint listed in issuer compliance docs.\"," +
                    "\"url\":\"https://issuer.example/docs\"}]" +
                    "}"), Encoding.UTF8, "application/json")
            };
        });

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Available, result.Availability);
        Assert.Equal(TokenExternalAssetType.TokenizedStock, result.AssetType);
    }

    [Fact]
    public async Task ResearchAsync_AmbiguousEvidence_ReturnsAmbiguousFailureReason()
    {
        var handler = new StubHttpMessageHandler((_, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(CreateModelOutput("{" +
                    "\"availability\":\"ambiguous_evidence\"," +
                    "\"assetType\":\"unknown\"," +
                    "\"projectName\":null," +
                    "\"summary\":null," +
                    "\"confidence\":\"LOW\"," +
                    "\"mintConfirmed\":false," +
                    "\"ambiguousIdentity\":true," +
                    "\"evidence\":[]" +
                    "}"), Encoding.UTF8, "application/json")
            });
        });

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.AmbiguousEvidence, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_NoRelevantEvidence_ReturnsNoRelevantFailureReason()
    {
        var handler = new StubHttpMessageHandler((_, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(CreateModelOutput("{" +
                    "\"availability\":\"no_relevant_evidence\"," +
                    "\"assetType\":\"unknown\"," +
                    "\"projectName\":null," +
                    "\"summary\":null," +
                    "\"confidence\":\"LOW\"," +
                    "\"mintConfirmed\":false," +
                    "\"ambiguousIdentity\":false," +
                    "\"evidence\":[]" +
                    "}"), Encoding.UTF8, "application/json")
            });
        });

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.NoRelevantEvidence, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_InvalidResponse_ReturnsInvalidResponse()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json")
        }));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_ProviderDisabled_DoesNotCallTransport()
    {
        var callCount = 0;
        var handler = new StubHttpMessageHandler((_, _) =>
        {
            callCount += 1;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });

        var provider = CreateProvider(
            handler,
            configureGemini: options => options.Enabled = false);

        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextFailureReason.Disabled, result.FailureReason);
        Assert.Equal(0, callCount);
    }

    private static string CreateModelOutput(string modelJson)
    {
        return "{" +
               "\"steps\":[{" +
               "\"type\":\"model_output\"," +
               "\"content\":[{" +
               "\"type\":\"text\"," +
               "\"text\":" + JsonSerializer.Serialize(modelJson) +
               "}]}]}";
    }

    private static GeminiTokenExternalContextProvider CreateProvider(
        HttpMessageHandler handler,
        Action<GeminiOptions>? configureGemini = null,
        Action<TokenExternalContextOptions>? configureContext = null)
    {
        var gemini = new GeminiOptions
        {
            Enabled = true,
            ApiKey = "test-key",
            BaseUrl = "https://generativelanguage.googleapis.com",
            Model = "gemini-2.5-flash-lite",
            TimeoutSeconds = 15,
            EnableGoogleSearch = true,
            MaxResponseBytes = 1024 * 1024
        };

        var context = new TokenExternalContextOptions();

        configureGemini?.Invoke(gemini);
        configureContext?.Invoke(context);

        return new GeminiTokenExternalContextProvider(
            new HttpClient(handler) { BaseAddress = new Uri(gemini.BaseUrl) },
            Options.Create(gemini),
            Options.Create(context),
            NullLogger<GeminiTokenExternalContextProvider>.Instance);
    }

    private static TokenExternalContextRequest CreateRequest()
    {
        return new TokenExternalContextRequest(
            Mint: "ResearchMint1111111111111111111111111111111",
            TokenName: "Research Token",
            TokenSymbol: "RSC",
            TokenProgram: "spl-token",
            Authorities: new Domain.Models.TokenAuthorities("MintAuth", false, "FreezeAuth", false),
            KnownOfficialSources: new[]
            {
                new TokenExternalContextKnownSource(
                    "https://docs.example.com/token",
                    TokenExternalContextSourceType.OfficialDocumentation,
                    "Example Docs")
            });
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
