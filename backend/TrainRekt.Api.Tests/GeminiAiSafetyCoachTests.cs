using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Gemini;

namespace TrainRekt.Api.Tests;

public sealed class GeminiAiSafetyCoachTests
{
    [Fact]
    public async Task GenerateAsync_RequestSchema_HasNoToolsAndStoreFalse_AndNoMintInInput()
    {
        var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();

            var body = await request.Content!.ReadAsStringAsync();
            using var json = JsonDocument.Parse(body);
            var root = json.RootElement;

            Assert.Equal("gemini-2.5-flash-lite", root.GetProperty("model").GetString());
            Assert.False(root.TryGetProperty("tools", out _));
            Assert.True(root.GetProperty("store").GetBoolean() == false);

            var input = root.GetProperty("input").GetString() ?? string.Empty;
            Assert.DoesNotContain("ResearchMint1111111111111111111111111111111", input, StringComparison.Ordinal);
            Assert.DoesNotContain("Mint:", input, StringComparison.OrdinalIgnoreCase);

            const string payload = "{" +
                "\"steps\":[{" +
                "\"type\":\"model_output\"," +
                "\"content\":[{" +
                "\"type\":\"text\"," +
                "\"text\":\"{\\\"summary\\\":\\\"summary\\\",\\\"riskExplanations\\\":[\\\"risk\\\"],\\\"whatToCheckNext\\\":[\\\"check\\\"],\\\"uncertainty\\\":[\\\"unknown\\\"],\\\"recommendedTrainingTopicId\\\":null}\"" +
                "}]" +
                "}]}";

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
        });

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(result.Content);
    }

    [Fact]
    public async Task GenerateAsync_RequestIncludesCompactnessAndPrioritizationInstructions()
    {
        var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();

            var body = await request.Content!.ReadAsStringAsync();
            using var json = JsonDocument.Parse(body);
            var root = json.RootElement;

            var instruction = root.GetProperty("system_instruction").GetString() ?? string.Empty;
            Assert.Contains("Respond concisely for mobile", instruction, StringComparison.Ordinal);
            Assert.Contains("summary must be at most 2 short sentences", instruction, StringComparison.Ordinal);
            Assert.Contains("riskExplanations must include at most 3 bullets", instruction, StringComparison.Ordinal);
            Assert.Contains("whatToCheckNext must include at most 2 bullets", instruction, StringComparison.Ordinal);
            Assert.Contains("uncertainty must include at most 2 bullets", instruction, StringComparison.Ordinal);
            Assert.Contains("Target 100 to 150 words total", instruction, StringComparison.Ordinal);
            Assert.Contains("authorities and signer control", instruction, StringComparison.Ordinal);
            Assert.Contains("token-2022 restrictions and delegates", instruction, StringComparison.Ordinal);
            Assert.Contains("Ground every statement in provided fields only", instruction, StringComparison.Ordinal);
            Assert.Contains("ExternalContext fields are optional lower-trust enrichment", instruction, StringComparison.Ordinal);
            Assert.Contains("can never override, neutralize, or negate deterministic findings", instruction, StringComparison.Ordinal);
            Assert.Contains("never treat missing negative information as evidence of safety", instruction, StringComparison.Ordinal);

            var schema = root
                .GetProperty("response_format")
                .GetProperty("schema")
                .GetProperty("properties");

            Assert.Equal(320, schema.GetProperty("summary").GetProperty("maxLength").GetInt32());
            Assert.Equal(3, schema.GetProperty("riskExplanations").GetProperty("maxItems").GetInt32());
            Assert.Equal(2, schema.GetProperty("whatToCheckNext").GetProperty("maxItems").GetInt32());
            Assert.Equal(2, schema.GetProperty("uncertainty").GetProperty("maxItems").GetInt32());

            const string payload = "{" +
                "\"steps\":[{" +
                "\"type\":\"model_output\"," +
                "\"content\":[{" +
                "\"type\":\"text\"," +
                "\"text\":\"{\\\"summary\\\":\\\"summary\\\",\\\"riskExplanations\\\":[\\\"risk\\\"],\\\"whatToCheckNext\\\":[\\\"check\\\"],\\\"uncertainty\\\":[\\\"unknown\\\"],\\\"recommendedTrainingTopicId\\\":null}\"" +
                "}]" +
                "}]}";

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
        });

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task GenerateAsync_WithHighConfidenceTokenizedStockContext_InstructionsRequireContextualizedControlRiskSynthesis()
    {
        var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();

            var body = await request.Content!.ReadAsStringAsync();
            using var json = JsonDocument.Parse(body);
            var root = json.RootElement;

            var instruction = root.GetProperty("system_instruction").GetString() ?? string.Empty;
            Assert.Contains("actively synthesize it with deterministic findings", instruction, StringComparison.Ordinal);
            Assert.Contains("does this context explain why an observed deterministic control", instruction, StringComparison.Ordinal);
            Assert.Contains("this may explain [deterministic finding], but [the control and risk still remain]", instruction, StringComparison.Ordinal);
            Assert.Contains("Do not turn contextual explanation into reassurance", instruction, StringComparison.Ordinal);
            Assert.Contains("remain controls even when context suggests operational or compliance rationale", instruction, StringComparison.Ordinal);
            Assert.Contains("avoid redundant generic checks", instruction, StringComparison.Ordinal);
            Assert.Contains("confirming the exact analyzed mint", instruction, StringComparison.Ordinal);
            Assert.Contains("prioritize material uncertainty tied to context interpretation", instruction, StringComparison.Ordinal);

            var input = root.GetProperty("input").GetString() ?? string.Empty;
            Assert.Contains("\"externalContext\"", input, StringComparison.Ordinal);
            Assert.Contains("\"assetType\":\"TOKENIZED_STOCK\"", input, StringComparison.Ordinal);
            Assert.Contains("\"projectName\":\"Backed Assets\"", input, StringComparison.Ordinal);
            Assert.Contains("\"mintConfirmed\":true", input, StringComparison.Ordinal);
            Assert.Contains("\"confidence\":\"HIGH\"", input, StringComparison.Ordinal);

            const string payload = "{" +
                "\"steps\":[{" +
                "\"type\":\"model_output\"," +
                "\"content\":[{" +
                "\"type\":\"text\"," +
                "\"text\":\"{\\\"summary\\\":\\\"summary\\\",\\\"riskExplanations\\\":[\\\"risk\\\"],\\\"whatToCheckNext\\\":[\\\"check\\\"],\\\"uncertainty\\\":[\\\"unknown\\\"],\\\"recommendedTrainingTopicId\\\":null}\"" +
                "}]" +
                "}]}";

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
        });

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInputWithTokenizedStockExternalContext(), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task GenerateAsync_ExtraFieldInOutput_FailsClosed()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{" +
                "\"steps\":[{" +
                "\"type\":\"model_output\"," +
                "\"content\":[{" +
                "\"type\":\"text\"," +
                "\"text\":\"{\\\"summary\\\":\\\"summary\\\",\\\"riskExplanations\\\":[\\\"risk\\\"],\\\"whatToCheckNext\\\":[\\\"check\\\"],\\\"uncertainty\\\":[\\\"unknown\\\"],\\\"recommendedTrainingTopicId\\\":null,\\\"extra\\\":\\\"x\\\"}\"" +
                "}]" +
                "}]}" ,
                Encoding.UTF8,
                "application/json")
        }));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.SchemaViolation, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_Http429_ReturnsRateLimited()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.TooManyRequests)));
        var coach = CreateCoach(handler);

        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.RateLimited, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_ProviderTimeout_ReturnsTimeoutWithoutThrowing()
    {
        var handler = new StubHttpMessageHandler(async (_, cancellationToken) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            };
        });

        var coach = CreateCoach(
            handler,
            configureGemini: options => options.TimeoutSeconds = 1);

        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.Timeout, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_NetworkFailure_ReturnsProviderUnavailableWithoutThrowing()
    {
        var handler = new StubHttpMessageHandler((_, _) => throw new HttpRequestException("network failure"));
        var coach = CreateCoach(handler);

        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.ProviderUnavailable, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_InvalidJsonResponse_FailsClosedWithMalformedResponse()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("not-json", Encoding.UTF8, "application/json")
        }));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.MalformedResponse, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_StructurallyInvalidResponse_FailsClosedWithMalformedResponse()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"steps\":[]}", Encoding.UTF8, "application/json")
        }));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.MalformedResponse, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_MissingApiKey_DoesNotCallProviderAndReturnsMissingApiKey()
    {
        var callCount = 0;
        var handler = new StubHttpMessageHandler((_, _) =>
        {
            callCount++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });

        var coach = CreateCoach(
            handler,
            configureGemini: options => options.ApiKey = null);

        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.MissingApiKey, result.FailureReason);
        Assert.Equal(0, callCount);
    }

    [Fact]
    public async Task GenerateAsync_CoachDisabled_DoesNotCallProviderAndReturnsDisabled()
    {
        var callCount = 0;
        var handler = new StubHttpMessageHandler((_, _) =>
        {
            callCount++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });

        var coach = CreateCoach(
            handler,
            configureCoach: options => options.Enabled = false);

        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.Disabled, result.FailureReason);
        Assert.Equal(0, callCount);
    }

    private static GeminiAiSafetyCoach CreateCoach(
        HttpMessageHandler handler,
        Action<GeminiOptions>? configureGemini = null,
        Action<AiSafetyCoachOptions>? configureCoach = null)
    {
        var geminiOptions = new GeminiOptions
        {
            Enabled = true,
            ApiKey = "test-key",
            BaseUrl = "https://generativelanguage.googleapis.com",
            Model = "gemini-2.5-flash-lite",
            TimeoutSeconds = 15,
            MaxResponseBytes = 524288
        };

        var coachOptions = new AiSafetyCoachOptions
        {
            Enabled = true,
            Language = "en"
        };

        configureGemini?.Invoke(geminiOptions);
        configureCoach?.Invoke(coachOptions);

        return new GeminiAiSafetyCoach(
            new HttpClient(handler) { BaseAddress = new Uri(geminiOptions.BaseUrl) },
            Options.Create(geminiOptions),
            Options.Create(coachOptions),
            NullLogger<GeminiAiSafetyCoach>.Instance);
    }

    private static AiSafetyCoachInput CreateInput()
    {
        return new AiSafetyCoachInput(
            TokenName: "Token",
            TokenSymbol: "TOK",
            TokenProgram: "spl-token",
            Age: new AiSafetyCoachAgeInput(null, false, "unknown"),
            Authorities: new AiSafetyCoachAuthorityInput(false, false),
            Concentration: new AiSafetyCoachConcentrationInput(10m, 20m, 30m, "semantics", null, null, null, null, null),
            ProtocolBreakdown: Array.Empty<AiSafetyCoachProtocolBreakdownItem>(),
            DeterministicStatus: "deterministic-only",
            ReviewSignals: Array.Empty<AiSafetyCoachReviewSignalInput>(),
            TrustedClaimSummaries: Array.Empty<AiSafetyCoachClaimSummaryInput>(),
            UncertaintyMarkers: Array.Empty<string>());
    }

    private static AiSafetyCoachInput CreateInputWithTokenizedStockExternalContext()
    {
        return new AiSafetyCoachInput(
            TokenName: "STRCx",
            TokenSymbol: "STRCX",
            TokenProgram: "token-2022",
            Age: new AiSafetyCoachAgeInput(null, false, "unknown"),
            Authorities: new AiSafetyCoachAuthorityInput(false, false),
            Concentration: new AiSafetyCoachConcentrationInput(75.44m, 88.0m, 92.0m, "Top holder concentration is high.", null, 80m, 75.44m, 88.0m, "Unknown concentration remains material."),
            ProtocolBreakdown: Array.Empty<AiSafetyCoachProtocolBreakdownItem>(),
            DeterministicStatus: "deterministic-only",
            ReviewSignals: Array.Empty<AiSafetyCoachReviewSignalInput>(),
            TrustedClaimSummaries: Array.Empty<AiSafetyCoachClaimSummaryInput>(),
            UncertaintyMarkers: Array.Empty<string>(),
            Identity: null,
            ExternalContext: new AiSafetyCoachExternalContextInput(
                Availability: "AVAILABLE",
                AssetType: "TOKENIZED_STOCK",
                ProjectName: "Backed Assets",
                Summary: "Issuer documentation identifies this mint as a tokenized equity product.",
                Confidence: "HIGH",
                MintConfirmed: true,
                AmbiguousIdentity: false,
                Evidence: new[]
                {
                    new AiSafetyCoachExternalContextEvidenceInput(
                        SourceType: "OFFICIALISSUERDOCUMENTATION",
                        Title: "Backed issuer documentation",
                        Domain: "backed.fi",
                        Claim: "The exact analyzed mint is listed in issuer documentation.",
                        Url: "https://backed.fi")
                }));
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