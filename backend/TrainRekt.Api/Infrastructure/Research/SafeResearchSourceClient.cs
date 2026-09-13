using System.Diagnostics;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;

namespace TrainRekt.Api.Infrastructure.Research;

public sealed class SafeResearchSourceClient : ISafeResearchSourceClient
{
    private static readonly HashSet<string> SupportedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "text/html",
        "text/plain",
        "application/json",
        "text/markdown",
        "text/x-markdown",
        "text/md",
        "application/markdown"
    };

    private readonly HttpClient _httpClient;
    private readonly ResearchUrlSafetyPolicy _urlPolicy;
    private readonly TokenResearchOptions _options;
    private readonly ILogger<SafeResearchSourceClient> _logger;

    public SafeResearchSourceClient(
        HttpClient httpClient,
        ResearchUrlSafetyPolicy urlPolicy,
        IOptions<TokenResearchOptions> options,
        ILogger<SafeResearchSourceClient> logger)
    {
        _httpClient = httpClient;
        _urlPolicy = urlPolicy;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<SafeSourceFetchResult> FetchAsync(CandidateResearchSource candidateSource, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(candidateSource.Url, UriKind.Absolute, out var currentUri))
        {
            return Rejected(ResearchSourceAssessmentReason.InvalidUrl, "Candidate URL is invalid.");
        }

        var redirects = 0;
        var stopwatch = Stopwatch.StartNew();

        while (true)
        {
            var validation = await _urlPolicy.ValidateAsync(currentUri, cancellationToken);
            if (!validation.IsAllowed || validation.NormalizedUri is null)
            {
                return Rejected(validation.Reason, validation.Detail, validation.NormalizedHost);
            }

            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            linkedCts.CancelAfter(TimeSpan.FromSeconds(_options.SourceTimeoutSeconds));

            HttpResponseMessage response;
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, validation.NormalizedUri);
                request.Headers.UserAgent.ParseAdd("TrainRektResearchAssessor/1.0");
                request.Headers.Accept.ParseAdd("text/html, text/plain, application/json, text/markdown, text/x-markdown, text/md, application/markdown");
                request.Headers.ConnectionClose = true;
                request.Options.Set(
                    ResearchEndpointPinning.RequestOptionKey,
                    new ResearchPinnedEndpoint(
                        Host: validation.NormalizedHost ?? validation.NormalizedUri.Host,
                        Port: validation.NormalizedUri.Port,
                        AllowedAddresses: validation.ResolvedAddresses));

                response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, linkedCts.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                return Rejected(ResearchSourceAssessmentReason.Timeout, "Source request timed out.", validation.NormalizedHost);
            }
            catch (HttpRequestException)
            {
                return Rejected(ResearchSourceAssessmentReason.HttpNotSuccessful, "Network request failed.", validation.NormalizedHost);
            }

            using (response)
            {
                if (IsRedirect(response.StatusCode))
                {
                    if (redirects >= _options.MaxRedirects)
                    {
                        return Rejected(ResearchSourceAssessmentReason.TooManyRedirects, "Redirect limit exceeded.", validation.NormalizedHost);
                    }

                    if (response.Headers.Location is null)
                    {
                        return Rejected(ResearchSourceAssessmentReason.RedirectRejected, "Redirect response was missing Location header.", validation.NormalizedHost);
                    }

                    currentUri = response.Headers.Location.IsAbsoluteUri
                        ? response.Headers.Location
                        : new Uri(validation.NormalizedUri, response.Headers.Location);

                    redirects++;
                    continue;
                }

                if (!response.IsSuccessStatusCode)
                {
                    return Rejected(ResearchSourceAssessmentReason.HttpNotSuccessful, $"HTTP status code {(int)response.StatusCode}.", validation.NormalizedHost);
                }

                var mediaType = response.Content.Headers.ContentType?.MediaType;
                if (string.IsNullOrWhiteSpace(mediaType) || !SupportedContentTypes.Contains(mediaType))
                {
                    return Rejected(ResearchSourceAssessmentReason.UnsupportedContentType, "Unsupported content type.", validation.NormalizedHost);
                }

                if (response.Content.Headers.ContentLength is long contentLength && contentLength > _options.MaxResponseBytes)
                {
                    return Rejected(ResearchSourceAssessmentReason.ResponseTooLarge, "Content-Length exceeds configured limit.", validation.NormalizedHost);
                }

                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                using var memory = new MemoryStream();
                var buffer = new byte[8192];
                var totalBytesRead = 0;

                while (true)
                {
                    var bytesRead = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
                    if (bytesRead == 0)
                    {
                        break;
                    }

                    totalBytesRead += bytesRead;
                    if (totalBytesRead > _options.MaxResponseBytes)
                    {
                        return Rejected(ResearchSourceAssessmentReason.ResponseTooLarge, "Streamed response exceeded configured limit.", validation.NormalizedHost);
                    }

                    memory.Write(buffer, 0, bytesRead);
                }

                var content = System.Text.Encoding.UTF8.GetString(memory.ToArray());

                _logger.LogInformation(
                    "Fetched source host {Host} for source {SourceId} in {DurationMs}ms with {Bytes} bytes.",
                    validation.NormalizedHost,
                    candidateSource.Id,
                    stopwatch.ElapsedMilliseconds,
                    totalBytesRead);

                return new SafeSourceFetchResult(
                    Success: true,
                    FinalUri: validation.NormalizedUri,
                    NormalizedHost: validation.NormalizedHost,
                    ContentType: mediaType,
                    Content: content,
                    BytesRead: totalBytesRead,
                    Reason: ResearchSourceAssessmentReason.None,
                    Detail: null);
            }
        }
    }

    private static bool IsRedirect(System.Net.HttpStatusCode statusCode)
    {
        return statusCode == System.Net.HttpStatusCode.Moved
            || statusCode == System.Net.HttpStatusCode.Redirect
            || statusCode == System.Net.HttpStatusCode.RedirectMethod
            || statusCode == System.Net.HttpStatusCode.TemporaryRedirect
            || (int)statusCode == 308;
    }

    private static SafeSourceFetchResult Rejected(ResearchSourceAssessmentReason reason, string? detail, string? host = null)
    {
        return new SafeSourceFetchResult(
            Success: false,
            FinalUri: null,
            NormalizedHost: host,
            ContentType: null,
            Content: null,
            BytesRead: 0,
            Reason: reason,
            Detail: detail);
    }
}
