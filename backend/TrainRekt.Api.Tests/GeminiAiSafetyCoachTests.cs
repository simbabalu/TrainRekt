using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
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
    public async Task GenerateAsync_PlainValidJsonObject_Succeeds()
    {
        var json = CreateCoachJson();
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(json)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(result.Content);
    }

    [Fact]
    public async Task GenerateAsync_JsonMarkdownFence_Succeeds()
    {
        var json = CreateCoachJson();
        var fenced = $"```json\n{json}\n```";
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(fenced)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task GenerateAsync_GenericMarkdownFence_Succeeds()
    {
        var json = CreateCoachJson();
        var fenced = $"```\n{json}\n```";
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(fenced)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task GenerateAsync_LeadingProseSingleJsonObject_Succeeds()
    {
        var json = CreateCoachJson();
        var wrapped = $"Here is the structured result:\n{json}";
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(wrapped)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task GenerateAsync_TrailingProseSingleJsonObject_Succeeds()
    {
        var json = CreateCoachJson();
        var wrapped = $"{json}\nDone.";
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(wrapped)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task GenerateAsync_LeadingAndTrailingProseSingleJsonObject_Succeeds()
    {
        var json = CreateCoachJson();
        var wrapped = $"Structured response follows:\n{json}\nEnd of response.";
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(wrapped)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task GenerateAsync_NestedJsonObjectCandidate_ReachesSchemaValidation()
    {
        var jsonWithNested = JsonSerializer.Serialize(new
        {
            summary = "summary",
            riskExplanations = new[] { "risk" },
            whatToCheckNext = new[] { "check" },
            uncertainty = new[] { "unknown" },
            recommendedTrainingTopicId = (string?)null,
            nested = new { key = "value" }
        });
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(jsonWithNested)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.SchemaViolation, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_BracesInsideString_DoNotBreakExtraction()
    {
        var json = CreateCoachJson(summary: "Context note includes braces {like this} safely.");
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse($"Intro\n{json}\nOutro")));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
        Assert.NotNull(result.Content);
        Assert.Equal("Context note includes braces {like this} safely.", result.Content!.Summary);
    }

    [Fact]
    public async Task GenerateAsync_EscapedQuotes_DoNotBreakExtraction()
    {
        var json = CreateCoachJson(summary: "Use caution with \"official\" claims.");
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse($"Result:\n{json}")));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("Use caution with \"official\" claims.", result.Content!.Summary);
    }

    [Fact]
    public async Task GenerateAsync_EscapedBackslashes_DoNotBreakExtraction()
    {
        var json = CreateCoachJson(summary: "Evidence path C:\\logs\\coach remains contextual.");
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse($"Result:\n{json}")));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("Evidence path C:\\logs\\coach remains contextual.", result.Content!.Summary);
    }

    [Fact]
    public async Task GenerateAsync_UnbalancedJsonObject_FailsClosedMalformedResponse()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse("{\"summary\":\"x\"")));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.MalformedResponse, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_JsonArrayRoot_FailsClosedMalformedResponse()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse("[{\"summary\":\"x\"}]")));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.MalformedResponse, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_NoJsonObject_FailsClosedMalformedResponse()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse("No structured output available.")));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.MalformedResponse, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_TwoJsonObjects_FailsClosedAsAmbiguousMalformedResponse()
    {
        var first = CreateCoachJson(summary: "first summary");
        var second = CreateCoachJson(summary: "second summary");
        var combined = $"{first}\n{second}";
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(combined)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.MalformedResponse, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_WrongFieldType_FailsClosedSchemaViolation()
    {
        var wrongTypeJson = JsonSerializer.Serialize(new
        {
            summary = "summary",
            riskExplanations = "not-an-array",
            whatToCheckNext = new[] { "check" },
            uncertainty = new[] { "unknown" },
            recommendedTrainingTopicId = (string?)null
        });
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(wrongTypeJson)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.SchemaViolation, result.FailureReason);
    }

    [Fact]
    public async Task GenerateAsync_Http200WithProseWrappedJson_RecoversAndSucceeds()
    {
        var json = CreateCoachJson();
        var wrapped = $"I will return JSON below.\n{json}\nThis concludes the structured response.";
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(wrapped)));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
    }

    [Fact]
    public async Task GenerateAsync_MaxTokenFinishReasonWithTruncatedJson_MapsToOutputTruncated()
    {
        var logger = new CapturingLogger<GeminiAiSafetyCoach>();
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(
            "{\"summary\":\"summary\",\"riskExplanations\":[\"risk\"],",
            finishReason: "MAX_TOKENS",
            promptTokenCount: 210,
            candidateTokenCount: 260,
            totalTokenCount: 470)));

        var coach = CreateCoach(handler, logger: logger);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.OutputTruncated, result.FailureReason);
        Assert.Equal("Coach response was truncated before valid JSON object completion.", result.Detail);
    }

    [Fact]
    public async Task GenerateAsync_StopFinishReasonWithUnbalancedJson_RemainsMalformedResponse()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(
            "{\"summary\":\"summary\",\"riskExplanations\":[\"risk\"],",
            finishReason: "STOP")));

        var coach = CreateCoach(handler);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(AiSafetyCoachFailureReason.MalformedResponse, result.FailureReason);
        Assert.Equal("Coach response did not contain valid JSON object output.", result.Detail);
    }

    [Fact]
    public async Task GenerateAsync_ParseFailure_LogsFinishReasonAndUsageWithoutRawText()
    {
        var logger = new CapturingLogger<GeminiAiSafetyCoach>();
        const string sensitiveMarker = "RAW-COACH-TEXT-SHOULD-NOT-BE-LOGGED";
        var truncated = "{\"summary\":\"" + sensitiveMarker + "\",";
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(
            truncated,
            finishReason: "MAX_TOKENS",
            finishMessage: "Reached max output tokens.",
            promptTokenCount: 111,
            candidateTokenCount: 260,
            totalTokenCount: 371)));

        var coach = CreateCoach(handler, logger: logger);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.False(result.Success);
        var warningLog = Assert.Single(logger.Entries.Where(entry => entry.Level == LogLevel.Warning && entry.Message.Contains("output was not a valid JSON object", StringComparison.Ordinal)));
        Assert.Contains("finishReason=MAX_TOKENS", warningLog.Message, StringComparison.Ordinal);
        Assert.Contains("promptTokenCount=111", warningLog.Message, StringComparison.Ordinal);
        Assert.Contains("candidateTokenCount=260", warningLog.Message, StringComparison.Ordinal);
        Assert.Contains("totalTokenCount=371", warningLog.Message, StringComparison.Ordinal);
        Assert.Contains("maxOutputTokens=700", warningLog.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(sensitiveMarker, warningLog.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GenerateAsync_Success_LogsFinishReasonMetadata()
    {
        var logger = new CapturingLogger<GeminiAiSafetyCoach>();
        var json = CreateCoachJson();
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(CreateModelOutputResponse(
            json,
            finishReason: "STOP",
            promptTokenCount: 99,
            candidateTokenCount: 35,
            totalTokenCount: 134)));

        var coach = CreateCoach(handler, logger: logger);
        var result = await coach.GenerateAsync(CreateInput(), CancellationToken.None);

        Assert.True(result.Success);
        var infoLog = Assert.Single(logger.Entries.Where(entry => entry.Level == LogLevel.Information && entry.Message.Contains("Gemini coach response metadata", StringComparison.Ordinal)));
        Assert.Contains("finishReason=STOP", infoLog.Message, StringComparison.Ordinal);
        Assert.Contains("promptTokenCount=99", infoLog.Message, StringComparison.Ordinal);
        Assert.Contains("candidateTokenCount=35", infoLog.Message, StringComparison.Ordinal);
        Assert.Contains("totalTokenCount=134", infoLog.Message, StringComparison.Ordinal);
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
    public async Task GenerateAsync_MissingRequiredSection_FailsClosed()
    {
        var handler = new StubHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                "{" +
                "\"steps\":[{" +
                "\"type\":\"model_output\"," +
                "\"content\":[{" +
                "\"type\":\"text\"," +
                "\"text\":\"{\\\"summary\\\":\\\"summary\\\",\\\"riskExplanations\\\":[\\\"risk\\\"],\\\"whatToCheckNext\\\":[\\\"check\\\"],\\\"recommendedTrainingTopicId\\\":null}\"" +
                "}]" +
                "}]}",
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
        Action<AiSafetyCoachOptions>? configureCoach = null,
        ILogger<GeminiAiSafetyCoach>? logger = null)
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
            logger ?? NullLogger<GeminiAiSafetyCoach>.Instance);
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

    private static string CreateCoachJson(
        string summary = "summary",
        IReadOnlyList<string>? riskExplanations = null,
        IReadOnlyList<string>? whatToCheckNext = null,
        IReadOnlyList<string>? uncertainty = null,
        string? recommendedTrainingTopicId = null)
    {
        return JsonSerializer.Serialize(new
        {
            summary,
            riskExplanations = riskExplanations ?? new[] { "risk" },
            whatToCheckNext = whatToCheckNext ?? new[] { "check" },
            uncertainty = uncertainty ?? new[] { "unknown" },
            recommendedTrainingTopicId
        });
    }

    private static HttpResponseMessage CreateModelOutputResponse(
        string text,
        string? finishReason = null,
        string? finishMessage = null,
        int? promptTokenCount = null,
        int? candidateTokenCount = null,
        int? totalTokenCount = null)
    {
        var usageMetadata = new Dictionary<string, object?>();
        if (promptTokenCount.HasValue)
        {
            usageMetadata["promptTokenCount"] = promptTokenCount.Value;
        }

        if (candidateTokenCount.HasValue)
        {
            usageMetadata["candidatesTokenCount"] = candidateTokenCount.Value;
        }

        if (totalTokenCount.HasValue)
        {
            usageMetadata["totalTokenCount"] = totalTokenCount.Value;
        }

        var modelOutputStep = new Dictionary<string, object?>
        {
            ["type"] = "model_output",
            ["content"] = new object[]
            {
                new
                {
                    type = "text",
                    text
                }
            }
        };

        if (!string.IsNullOrWhiteSpace(finishReason))
        {
            modelOutputStep["finishReason"] = finishReason;
        }

        if (!string.IsNullOrWhiteSpace(finishMessage))
        {
            modelOutputStep["finishMessage"] = finishMessage;
        }

        var payload = JsonSerializer.Serialize(new
        {
            steps = new[] { modelOutputStep },
            usageMetadata = usageMetadata.Count == 0 ? null : usageMetadata
        });

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
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

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public readonly List<LogEntry> Entries = new();

        public IDisposable BeginScope<TState>(TState state) where TState : notnull
        {
            return NullScope.Instance;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return true;
        }

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Entries.Add(new LogEntry(logLevel, formatter(state, exception)));
        }
    }

    private sealed record LogEntry(LogLevel Level, string Message);

    private sealed class NullScope : IDisposable
    {
        public static readonly NullScope Instance = new();

        public void Dispose()
        {
        }
    }
}