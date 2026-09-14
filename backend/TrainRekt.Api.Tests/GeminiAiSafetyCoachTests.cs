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