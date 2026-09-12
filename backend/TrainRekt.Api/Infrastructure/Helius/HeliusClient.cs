using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Infrastructure.Helius;

public sealed class HeliusClient : IHeliusClient
{
    private readonly HttpClient _httpClient;
    private readonly string? _apiKey;

    public HeliusClient(HttpClient httpClient, IOptions<HeliusOptions> options)
    {
        ArgumentNullException.ThrowIfNull(httpClient);
        ArgumentNullException.ThrowIfNull(options);

        var settings = options.Value;
        _httpClient = httpClient;
        _apiKey = settings.ApiKey;
    }

    public HttpRequestMessage CreateRpcPostRequest(string jsonRpcPayload)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(jsonRpcPayload);

        var endpoint = BuildRpcEndpoint(
            _httpClient.BaseAddress ?? throw new InvalidOperationException("Helius HttpClient base address is not configured."),
            _apiKey);
        var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(jsonRpcPayload)
        };
        request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse("application/json");
        return request;
    }

    public async Task<JsonDocument> SendRpcRequestAsync(string method, IReadOnlyList<object?> parameters, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(method);
        ArgumentNullException.ThrowIfNull(parameters);

        var payload = JsonSerializer.Serialize(new
        {
            jsonrpc = "2.0",
            id = Guid.NewGuid().ToString("N"),
            method,
            @params = parameters
        });

        using var request = CreateRpcPostRequest(payload);

        using var response = await SendAsync(request, cancellationToken);
        return await ParseResponseAsync(response, cancellationToken);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        try
        {
            return await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            throw new HeliusRpcException(
                HeliusRpcFailureKind.Transport,
                "Helius transport request failed.",
                innerException: exception);
        }
    }

    private static async Task<JsonDocument> ParseResponseAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (!response.IsSuccessStatusCode)
        {
            var statusCode = (int)response.StatusCode;
            if (statusCode == StatusCodes.Status429TooManyRequests)
            {
                throw new HeliusRpcException(HeliusRpcFailureKind.RateLimited, "Helius RPC rate limit was reached.");
            }

            throw new HeliusRpcException(HeliusRpcFailureKind.Transport, $"Helius RPC returned HTTP {statusCode}.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        JsonDocument document;
        try
        {
            document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        }
        catch (JsonException exception)
        {
            throw new HeliusRpcException(
                HeliusRpcFailureKind.MalformedResponse,
                "Helius RPC returned invalid JSON.",
                innerException: exception);
        }

        if (document.RootElement.TryGetProperty("error", out var errorElement) && errorElement.ValueKind != JsonValueKind.Null)
        {
            var providerCode = TryGetProviderErrorCode(errorElement);
            var providerMessage = TryGetProviderErrorMessage(errorElement);

            if (providerCode == 429 || ContainsRateLimitSignal(providerMessage))
            {
                throw new HeliusRpcException(
                    HeliusRpcFailureKind.RateLimited,
                    "Helius RPC rate limit was reached.",
                    providerErrorCode: providerCode,
                    providerErrorMessage: providerMessage);
            }

            throw new HeliusRpcException(
                HeliusRpcFailureKind.ProviderError,
                "Helius RPC returned a JSON-RPC error response.",
                providerErrorCode: providerCode,
                providerErrorMessage: providerMessage);
        }

        return document;
    }

    private static Uri BuildRpcEndpoint(Uri baseAddress, string? apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException(
                "Helius API key is not configured. Set HELIUS_API_KEY before invoking Helius-dependent functionality.");
        }

        var separator = baseAddress.Query.Length == 0 ? "?" : "&";
        return new Uri($"{baseAddress}{separator}api-key={Uri.EscapeDataString(apiKey)}", UriKind.Absolute);
    }

    private static int? TryGetProviderErrorCode(JsonElement errorElement)
    {
        if (!errorElement.TryGetProperty("code", out var codeElement))
        {
            return null;
        }

        return codeElement.ValueKind switch
        {
            JsonValueKind.Number when codeElement.TryGetInt32(out var code) => code,
            JsonValueKind.String when int.TryParse(codeElement.GetString(), out var code) => code,
            _ => null
        };
    }

    private static string? TryGetProviderErrorMessage(JsonElement errorElement)
    {
        if (!errorElement.TryGetProperty("message", out var messageElement)
            || messageElement.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return messageElement.GetString();
    }

    private static bool ContainsRateLimitSignal(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        return message.Contains("rate", StringComparison.OrdinalIgnoreCase)
            && message.Contains("limit", StringComparison.OrdinalIgnoreCase);
    }
}
