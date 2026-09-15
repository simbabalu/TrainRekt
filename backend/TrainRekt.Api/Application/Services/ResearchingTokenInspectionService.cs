using System.Diagnostics;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

// Thin compatibility wrapper: the legacy optional-research enrichment pipeline was removed
// because it had no active producer (see P0-2 audit). This preserves the researchStatus API
// shape by synthesizing NotRequired/ResearchRequired locally from deterministic facts only.
public sealed class ResearchingTokenInspectionService : ITokenInspectionService
{
    private readonly ITokenInspectionService _innerService;
    private readonly ResearchNeedDetector _needDetector;
    private readonly ILogger<ResearchingTokenInspectionService> _logger;

    public ResearchingTokenInspectionService(
        ITokenInspectionService innerService,
        ResearchNeedDetector needDetector,
        ILogger<ResearchingTokenInspectionService> logger)
    {
        _innerService = innerService;
        _needDetector = needDetector;
        _logger = logger;
    }

    public async Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
    {
        var totalStopwatch = Stopwatch.StartNew();

        var deterministicStopwatch = Stopwatch.StartNew();
        var deterministicResult = await _innerService.InspectAsync(mint, cancellationToken);
        var deterministicInspectionMs = ElapsedMilliseconds(deterministicStopwatch);
        if (deterministicResult.Error is not null || deterministicResult.Inspection is null)
        {
            _logger.LogInformation(
                "Token analysis timing for mint {Mint}: totalMs={TotalMs} deterministicInspectionMs={DeterministicInspectionMs} researchMs={ResearchMs} outcome={Outcome}.",
                mint,
                ElapsedMilliseconds(totalStopwatch),
                deterministicInspectionMs,
                0,
                "deterministic-error");
            return deterministicResult;
        }

        var deterministicInspection = deterministicResult.Inspection;

        var researchStopwatch = Stopwatch.StartNew();
        var outcome = SynthesizeOutcome(deterministicInspection);
        var researchMs = ElapsedMilliseconds(researchStopwatch);

        _logger.LogInformation(
            "Token analysis timing for mint {Mint}: totalMs={TotalMs} deterministicInspectionMs={DeterministicInspectionMs} researchMs={ResearchMs} outcome={Outcome} availability={Availability}.",
            deterministicInspection.Identity.Mint,
            ElapsedMilliseconds(totalStopwatch),
            deterministicInspectionMs,
            researchMs,
            outcome.Status,
            outcome.Availability);

        return TokenInspectionResult.Success(deterministicInspection, MapResearchStatus(outcome));
    }

    private ResearchOutcome SynthesizeOutcome(TokenInspection inspection)
    {
        var needs = _needDetector.Detect(inspection);
        if (needs.Count == 0)
        {
            return new ResearchOutcome(
                ResearchOutcomeStatus.NotRequired,
                needs,
                0,
                0,
                0,
                inspection.ProtocolContext,
                false,
                ResearchAvailability.NotAttempted);
        }

        return new ResearchOutcome(
            ResearchOutcomeStatus.ResearchRequired,
            needs,
            0,
            0,
            0,
            inspection.ProtocolContext,
            false,
            ResearchAvailability.NotAttempted,
            null,
            "deferred",
            "Optional research deferred outside the deterministic inspect response path.");
    }

    private static TokenInspectionResearchStatus MapResearchStatus(ResearchOutcome outcome)
    {
        return outcome.Availability switch
        {
            ResearchAvailability.NotAttempted => CreateResearchStatus(TokenInspectionResearchAvailability.NotAttempted, null, null, null),
            ResearchAvailability.Complete => CreateResearchStatus(TokenInspectionResearchAvailability.Complete, null, null, null),
            ResearchAvailability.Partial => CreateResearchStatus(
                TokenInspectionResearchAvailability.Partial,
                MapFailureCategory(outcome.FailureCategory),
                outcome.FailureStage,
                ToSafeMessage(outcome)),
            _ => CreateResearchStatus(
                TokenInspectionResearchAvailability.Unavailable,
                MapFailureCategory(outcome.FailureCategory),
                outcome.FailureStage,
                ToSafeMessage(outcome))
        };
    }

    private static TokenInspectionResearchFailureCategory? MapFailureCategory(ResearchFailureCategory? category)
    {
        return category switch
        {
            null => null,
            ResearchFailureCategory.Timeout => TokenInspectionResearchFailureCategory.Timeout,
            ResearchFailureCategory.Cancelled => TokenInspectionResearchFailureCategory.Cancelled,
            ResearchFailureCategory.ProviderUnavailable => TokenInspectionResearchFailureCategory.ProviderUnavailable,
            ResearchFailureCategory.NetworkFailure => TokenInspectionResearchFailureCategory.NetworkFailure,
            ResearchFailureCategory.InvalidProviderResponse => TokenInspectionResearchFailureCategory.InvalidProviderResponse,
            ResearchFailureCategory.RateLimited => TokenInspectionResearchFailureCategory.RateLimited,
            ResearchFailureCategory.ProviderRejected => TokenInspectionResearchFailureCategory.ProviderRejected,
            ResearchFailureCategory.Disabled => TokenInspectionResearchFailureCategory.Disabled,
            ResearchFailureCategory.MissingApiKey => TokenInspectionResearchFailureCategory.MissingApiKey,
            _ => TokenInspectionResearchFailureCategory.Unknown
        };
    }

    private static string? ToSafeMessage(ResearchOutcome outcome)
    {
        if (string.IsNullOrWhiteSpace(outcome.Detail))
        {
            return null;
        }

        return outcome.Detail;
    }

    private static TokenInspectionResearchStatus CreateResearchStatus(
        TokenInspectionResearchAvailability availability,
        TokenInspectionResearchFailureCategory? failureCategory,
        string? failureStage,
        string? message)
    {
        return new TokenInspectionResearchStatus(availability, failureCategory, failureStage, message);
    }

    private static long ElapsedMilliseconds(Stopwatch stopwatch)
    {
        return (long)Math.Round(stopwatch.Elapsed.TotalMilliseconds, MidpointRounding.AwayFromZero);
    }
}
