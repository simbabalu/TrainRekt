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

    public async Task<CandidateResearchResult> ResearchAsync(ResearchRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!_options.Enabled)
        {
            LogFailure(request.Mint, "research", GeminiFailureReason.Disabled, null, null);
            return EmptyResult;
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            LogFailure(request.Mint, "research", GeminiFailureReason.MissingApiKey, null, null);
            return EmptyResult;
        }

        var grounded = await _geminiClient.RunGroundedResearchAsync(request, cancellationToken);
        if (!grounded.Success || grounded.Value is null)
        {
            LogFailure(request.Mint, "research", grounded.FailureReason, grounded.HttpStatusCode, grounded.Detail);
            return EmptyResult;
        }

        var extraction = await _geminiClient.RunStructuredExtractionAsync(request, grounded.Value, cancellationToken);
        if (!extraction.Success || string.IsNullOrWhiteSpace(extraction.Value))
        {
            LogFailure(request.Mint, "extraction", extraction.FailureReason, extraction.HttpStatusCode, extraction.Detail);
            return EmptyResult;
        }

        var mapped = _candidateMapper.MapStructuredJson(extraction.Value);
        if (!mapped.Success || mapped.Value is null)
        {
            LogFailure(request.Mint, "extraction", mapped.FailureReason, null, mapped.Detail);
            return EmptyResult;
        }

        var bound = BindSourcesToGroundedCatalog(mapped.Value, grounded.Value.Sources);
        if (!bound.Success || bound.Value is null)
        {
            LogFailure(request.Mint, "extraction", bound.FailureReason, null, bound.Detail);
            return EmptyResult;
        }

        _logger.LogInformation(
            "Gemini provider produced candidate result for mint {Mint}. Model={Model}, Sources={SourceCount}, Claims={ClaimCount}.",
            request.Mint,
            _options.Model,
            bound.Value.Sources.Count,
            bound.Value.Claims.Count);

        return bound.Value;
    }

    private void LogFailure(string mint, string stage, GeminiFailureReason? reason, int? httpStatusCode, string? detail)
    {
        _logger.LogInformation(
            "Gemini provider call failed for mint {Mint}. Stage={Stage}, Model={Model}, Reason={Reason}, HttpStatus={HttpStatusCode}, Detail={Detail}.",
            mint,
            stage,
            _options.Model,
            reason,
            httpStatusCode,
            detail);
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
