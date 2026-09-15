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

    [Fact]
    public async Task ResearchAsync_FencedValidJson_Succeeds()
    {
        var fenced = "```json\n" + ValidContextJson() + "\n```";
        var handler = JsonResponseHandler(CreateEnvelope(fenced));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Available, result.Availability);
    }

    [Fact]
    public async Task ResearchAsync_ProseWrappedSingleObject_Succeeds()
    {
        var prose = "Here is the result:\n" + ValidContextJson() + "\nThanks for reading.";
        var handler = JsonResponseHandler(CreateEnvelope(prose));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Available, result.Availability);
    }

    [Fact]
    public async Task ResearchAsync_BracesInsideJsonStringValue_Succeeds()
    {
        var json = ValidContextJsonWithSummary("External docs mention protocol addresses like { vault } inside braces.");
        var handler = JsonResponseHandler(CreateEnvelope(json));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Available, result.Availability);
    }

    [Fact]
    public async Task ResearchAsync_EscapedQuoteInsideStringValue_Succeeds()
    {
        var json = ValidContextJsonWithSummary("Docs state \\\"official\\\" partnership terms.");
        var handler = JsonResponseHandler(CreateEnvelope(json));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Available, result.Availability);
    }

    [Fact]
    public async Task ResearchAsync_TruncatedJson_DoesNotThrow_ReturnsInvalidResponse()
    {
        var truncated = "{\"availability\":\"available\",\"assetType\":\"unknown\",\"summary\":\"partial output that got cut off";
        var handler = JsonResponseHandler(CreateEnvelope(truncated));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_UnterminatedString_DoesNotThrow_ReturnsInvalidResponse()
    {
        var unterminated = "{\"summary\":\"unfinished";
        var handler = JsonResponseHandler(CreateEnvelope(unterminated));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_MultipleTopLevelObjects_FailsClosed()
    {
        var multiple = "{\"a\":1}\n{\"b\":2}";
        var handler = JsonResponseHandler(CreateEnvelope(multiple));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_ArrayOnlyResponse_FailsClosed()
    {
        var arrayOnly = "[" + ValidContextJson() + "]";
        var handler = JsonResponseHandler(CreateEnvelope(arrayOnly));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_GarbageOnlyResponse_FailsClosed()
    {
        var garbage = "this is not json at all, just prose with no braces";
        var handler = JsonResponseHandler(CreateEnvelope(garbage));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_MalformedJsonWithBalancedBraces_IsNotFalselyRepaired()
    {
        var malformed = "{\"availability\": available}";
        var handler = JsonResponseHandler(CreateEnvelope(malformed));

        var provider = CreateProvider(handler);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_TokenLimitFinishReason_IsLoggedAsTruncationSuspected()
    {
        var truncated = "{\"availability\":\"available\",\"assetType\":\"unknown\",\"summary\":\"partial output that got cut off";
        var handler = JsonResponseHandler(CreateEnvelope(truncated, finishReason: "MAX_TOKENS"));
        var logger = new RecordingLogger<GeminiTokenExternalContextProvider>();

        var provider = CreateProvider(handler, logger: logger);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
        Assert.Contains(logger.Messages, message =>
            message.Contains("finishReason=MAX_TOKENS", StringComparison.Ordinal)
            && message.Contains("truncationSuspected=True", StringComparison.Ordinal));
    }

    [Fact]
    public async Task ResearchAsync_OversizedResponse_IsRejectedSafely()
    {
        var oversizedBody = new string('a', 4096);
        var handler = new StubHttpMessageHandler((_, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(oversizedBody, Encoding.UTF8, "application/json")
            });
        });

        var provider = CreateProvider(handler, configureGemini: options => options.MaxResponseBytes = 128);
        var result = await provider.ResearchAsync(CreateRequest(), CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.InvalidResponse, result.FailureReason);
    }

    [Fact]
    public async Task ResearchAsync_CancellationDuringBodyRead_Propagates()
    {
        var handler = new StubHttpMessageHandler((_, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new CancellingHttpContent()
            });
        });

        var provider = CreateProvider(handler);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            provider.ResearchAsync(CreateRequest(), CancellationToken.None));
    }

    private static string ValidContextJson()
    {
        return ValidContextJsonWithSummary("Issuer documentation references this mint for tokenized equity operations.");
    }

    private static string ValidContextJsonWithSummary(string summary)
    {
        return "{" +
               "\"availability\":\"available\"," +
               "\"assetType\":\"tokenized_stock\"," +
               "\"projectName\":\"IssuerX\"," +
               "\"summary\":\"" + summary + "\"," +
               "\"confidence\":\"MEDIUM\"," +
               "\"mintConfirmed\":true," +
               "\"ambiguousIdentity\":false," +
               "\"evidence\":[{" +
               "\"sourceType\":\"official_issuer_documentation\"," +
               "\"title\":\"Issuer docs\"," +
               "\"domain\":\"issuer.example\"," +
               "\"claim\":\"Mint listed in issuer compliance docs.\"," +
               "\"url\":\"https://issuer.example/docs\"}]" +
               "}";
    }

    private static string CreateEnvelope(string modelOutputText, string? finishReason = null)
    {
        var finishReasonJson = finishReason is null
            ? string.Empty
            : "\"finishReason\":" + JsonSerializer.Serialize(finishReason) + ",";

        return "{" +
               finishReasonJson +
               "\"steps\":[{" +
               "\"type\":\"model_output\"," +
               "\"content\":[{" +
               "\"type\":\"text\"," +
               "\"text\":" + JsonSerializer.Serialize(modelOutputText) +
               "}]}]}";
    }

    private static StubHttpMessageHandler JsonResponseHandler(string responseBody)
    {
        return new StubHttpMessageHandler((_, cancellationToken) =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
            });
        });
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
        Action<TokenExternalContextOptions>? configureContext = null,
        ILogger<GeminiTokenExternalContextProvider>? logger = null)
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
            logger ?? NullLogger<GeminiTokenExternalContextProvider>.Instance);
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

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = new();

        public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            Messages.Add(formatter(state, exception));
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();

            public void Dispose()
            {
            }
        }
    }

    private sealed class CancellingHttpContent : HttpContent
    {
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => Task.CompletedTask;

        protected override bool TryComputeLength(out long length)
        {
            length = 0;
            return true;
        }

        protected override Task<Stream> CreateContentReadStreamAsync() => Task.FromResult<Stream>(new CancellingStream());

        protected override Task<Stream> CreateContentReadStreamAsync(CancellationToken cancellationToken) => Task.FromResult<Stream>(new CancellingStream());
    }

    private sealed class CancellingStream : Stream
    {
        public override bool CanRead => true;

        public override bool CanSeek => false;

        public override bool CanWrite => false;

        public override long Length => throw new NotSupportedException();

        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            throw new OperationCanceledException("Simulated cancellation during response body read.");
        }

        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        public override void Flush() => throw new NotSupportedException();

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
