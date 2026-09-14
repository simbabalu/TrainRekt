using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;

namespace TrainRekt.Api.Infrastructure.Gemini;

public sealed class GeminiTokenResearchProvider : ITokenResearchProvider
{
    private static readonly CandidateResearchResult EmptyResult = new(
        IdentityEvidence: Array.Empty<CandidateIdentityEvidence>(),
        Sources: Array.Empty<CandidateResearchSource>(),
        Claims: Array.Empty<CandidateDocumentedClaim>());

    private readonly GeminiOptions _options;
    private readonly IGeminiInteractionClient _geminiClient;
    private readonly GeminiCandidateMapper _candidateMapper;
    private readonly ILogger<GeminiTokenResearchProvider> _logger;

    public GeminiTokenResearchProvider(
        IOptions<GeminiOptions> options,
        IGeminiInteractionClient geminiClient,
        GeminiCandidateMapper candidateMapper,
        ILogger<GeminiTokenResearchProvider> logger)
    {
        _options = options.Value;
        _geminiClient = geminiClient;
        _candidateMapper = candidateMapper;
        _logger = logger;
    }

    public async Task<ResearchProviderResult> ResearchAsync(ResearchRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!_options.Enabled)
        {
            const string detail = "Optional Gemini research is disabled by configuration.";
            LogFailure(request.Mint, "research", GeminiFailureReason.Disabled, null, detail);
            return Unavailable(ResearchFailureCategory.Disabled, "research", detail);
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            const string detail = "Optional Gemini research is unavailable because the provider key is missing.";
            LogFailure(request.Mint, "research", GeminiFailureReason.MissingApiKey, null, detail);
            return Unavailable(ResearchFailureCategory.MissingApiKey, "research", detail);
        }

        var grounded = await _geminiClient.RunGroundedResearchAsync(request, cancellationToken);
        if (!grounded.Success || grounded.Value is null)
        {
            LogFailure(request.Mint, "research", grounded.FailureReason, grounded.HttpStatusCode, grounded.Detail);
            return Unavailable(MapFailureCategory(grounded.FailureReason), "grounded_research", grounded.Detail);
        }

        var extraction = await _geminiClient.RunStructuredExtractionAsync(request, grounded.Value, cancellationToken);
        if (!extraction.Success || string.IsNullOrWhiteSpace(extraction.Value))
        {
            LogFailure(request.Mint, "extraction", extraction.FailureReason, extraction.HttpStatusCode, extraction.Detail);
            return Partial(MapFailureCategory(extraction.FailureReason), "structured_extraction", extraction.Detail);
        }

        var mapped = _candidateMapper.MapStructuredJson(extraction.Value);
        if (!mapped.Success || mapped.Value is null)
        {
            LogFailure(request.Mint, "extraction", mapped.FailureReason, null, mapped.Detail);
            return Partial(ResearchFailureCategory.InvalidProviderResponse, "structured_extraction", mapped.Detail);
        }

        var bound = BindSourcesToGroundedCatalog(mapped.Value, grounded.Value.Sources);
        if (!bound.Success || bound.Value is null)
        {
            LogFailure(request.Mint, "extraction", bound.FailureReason, null, bound.Detail);
            return Partial(ResearchFailureCategory.InvalidProviderResponse, "structured_extraction", bound.Detail);
        }

        _logger.LogInformation(
            "Gemini provider produced candidate result for mint {Mint}. Model={Model}, Sources={SourceCount}, Claims={ClaimCount}.",
            request.Mint,
            _options.Model,
            bound.Value.Sources.Count,
            bound.Value.Claims.Count);

        return new ResearchProviderResult(
            ResearchExecutionStatus.Complete,
            bound.Value,
            null,
            null,
            null);
    }

    private void LogFailure(string mint, string stage, GeminiFailureReason? reason, int? httpStatusCode, string? detail)
    {
        _logger.LogWarning(
            "Gemini provider call failed for mint {Mint}. Stage={Stage}, Model={Model}, Reason={Reason}, HttpStatus={HttpStatusCode}, Detail={Detail}.",
            mint,
            stage,
            _options.Model,
            reason,
            httpStatusCode,
            detail);
    }

    private static ResearchProviderResult Unavailable(ResearchFailureCategory category, string stage, string? detail)
    {
        return new ResearchProviderResult(
            ResearchExecutionStatus.Unavailable,
            EmptyResult,
            category,
            stage,
            detail);
    }

    private static ResearchProviderResult Partial(ResearchFailureCategory category, string stage, string? detail)
    {
        return new ResearchProviderResult(
            ResearchExecutionStatus.Partial,
            EmptyResult,
            category,
            stage,
            detail);
    }

    private static ResearchFailureCategory MapFailureCategory(GeminiFailureReason? reason)
    {
        return reason switch
        {
            GeminiFailureReason.Timeout => ResearchFailureCategory.Timeout,
            GeminiFailureReason.RateLimited => ResearchFailureCategory.RateLimited,
            GeminiFailureReason.ProviderUnavailable => ResearchFailureCategory.ProviderUnavailable,
            GeminiFailureReason.ProviderRejected => ResearchFailureCategory.ProviderRejected,
            GeminiFailureReason.MalformedResponse => ResearchFailureCategory.InvalidProviderResponse,
            GeminiFailureReason.SchemaViolation => ResearchFailureCategory.InvalidProviderResponse,
            GeminiFailureReason.GroundingUnavailable => ResearchFailureCategory.InvalidProviderResponse,
            GeminiFailureReason.NoUsefulSources => ResearchFailureCategory.InvalidProviderResponse,
            GeminiFailureReason.MissingApiKey => ResearchFailureCategory.MissingApiKey,
            GeminiFailureReason.Disabled => ResearchFailureCategory.Disabled,
            _ => ResearchFailureCategory.Unknown
        };
    }

    private static GeminiClientResult<CandidateResearchResult> BindSourcesToGroundedCatalog(
        CandidateResearchResult candidate,
        IReadOnlyList<GeminiCitation> groundedSources)
    {
        var groundedCatalog = groundedSources
            .Select((source, index) => new
            {
                Id = $"grounding-source-{index + 1}",
                source.Url
            })
            .ToDictionary(entry => entry.Id, entry => entry.Url, StringComparer.Ordinal);

        var reboundSources = new List<CandidateResearchSource>(candidate.Sources.Count);
        foreach (var source in candidate.Sources)
        {
            if (!groundedCatalog.TryGetValue(source.Id, out var groundedUrl))
            {
                return new GeminiClientResult<CandidateResearchResult>(
                    false,
                    null,
                    GeminiFailureReason.SchemaViolation,
                    $"Extraction sourceId '{source.Id}' was not present in grounded source catalog.");
            }

            reboundSources.Add(source with { Url = groundedUrl });
        }

        return new GeminiClientResult<CandidateResearchResult>(
            true,
            candidate with { Sources = reboundSources },
            null,
            null);
    }
}
