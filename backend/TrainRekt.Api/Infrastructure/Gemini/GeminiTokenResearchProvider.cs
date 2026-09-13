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

        _logger.LogInformation(
            "Gemini provider produced candidate result for mint {Mint}. Model={Model}, Sources={SourceCount}, Claims={ClaimCount}.",
            request.Mint,
            _options.Model,
            mapped.Value.Sources.Count,
            mapped.Value.Claims.Count);

        return mapped.Value;
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
}
