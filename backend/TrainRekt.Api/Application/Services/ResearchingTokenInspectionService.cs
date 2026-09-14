using System.Diagnostics;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Analysis;

namespace TrainRekt.Api.Application.Services;

public sealed class ResearchingTokenInspectionService : ITokenInspectionService
{
    private readonly ITokenInspectionService _innerService;
    private readonly ITokenResearchOrchestrator _researchOrchestrator;
    private readonly ILogger<ResearchingTokenInspectionService> _logger;

    public ResearchingTokenInspectionService(
        ITokenInspectionService innerService,
        ITokenResearchOrchestrator researchOrchestrator,
        ILogger<ResearchingTokenInspectionService> logger)
    {
        _innerService = innerService;
        _researchOrchestrator = researchOrchestrator;
        _logger = logger;
    }

    public async Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
    {
        var totalStopwatch = Stopwatch.StartNew();
        long deterministicInspectionMs = 0;
        long researchMs = 0;

        var deterministicStopwatch = Stopwatch.StartNew();
        var deterministicResult = await _innerService.InspectAsync(mint, cancellationToken);
        deterministicInspectionMs = ElapsedMilliseconds(deterministicStopwatch);
        if (deterministicResult.Error is not null || deterministicResult.Inspection is null)
        {
            _logger.LogInformation(
                "Token analysis timing for mint {Mint}: totalMs={TotalMs} deterministicInspectionMs={DeterministicInspectionMs} researchMs={ResearchMs} outcome={Outcome}.",
                mint,
                ElapsedMilliseconds(totalStopwatch),
                deterministicInspectionMs,
                researchMs,
                "deterministic-error");
            return deterministicResult;
        }

        var deterministicInspection = deterministicResult.Inspection;
        ResearchOutcome outcome;
        var researchStopwatch = Stopwatch.StartNew();
        try
        {
            outcome = await _researchOrchestrator.RunCacheOnlyAsync(deterministicInspection, cancellationToken);
            researchMs = ElapsedMilliseconds(researchStopwatch);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            researchMs = ElapsedMilliseconds(researchStopwatch);
            _logger.LogWarning(
                "Optional research timed out for mint {Mint}. Returning deterministic inspection.",
                deterministicInspection.Identity.Mint);

            _logger.LogInformation(
                "Token analysis timing for mint {Mint}: totalMs={TotalMs} deterministicInspectionMs={DeterministicInspectionMs} researchMs={ResearchMs} outcome={Outcome}.",
                deterministicInspection.Identity.Mint,
                ElapsedMilliseconds(totalStopwatch),
                deterministicInspectionMs,
                researchMs,
                "research-timeout");

            return TokenInspectionResult.Success(
                deterministicInspection,
                CreateResearchStatus(
                    TokenInspectionResearchAvailability.Unavailable,
                    TokenInspectionResearchFailureCategory.Timeout,
                    "provider_timeout",
                    "Optional research timed out."));
        }
        catch (Exception exception)
        {
            researchMs = ElapsedMilliseconds(researchStopwatch);
            _logger.LogWarning(
                exception,
                "Research enrichment failed for mint {Mint}. Returning deterministic inspection.",
                deterministicInspection.Identity.Mint);

            _logger.LogInformation(
                "Token analysis timing for mint {Mint}: totalMs={TotalMs} deterministicInspectionMs={DeterministicInspectionMs} researchMs={ResearchMs} outcome={Outcome}.",
                deterministicInspection.Identity.Mint,
                ElapsedMilliseconds(totalStopwatch),
                deterministicInspectionMs,
                researchMs,
                "research-exception");

            return TokenInspectionResult.Success(
                deterministicInspection,
                CreateResearchStatus(
                    TokenInspectionResearchAvailability.Unavailable,
                    TokenInspectionResearchFailureCategory.Unknown,
                    "research",
                    "Optional research failed."));
        }

        if (outcome.Status != ResearchOutcomeStatus.Completed || outcome.Context is null)
        {
            _logger.LogInformation(
                "Token analysis timing for mint {Mint}: totalMs={TotalMs} deterministicInspectionMs={DeterministicInspectionMs} researchMs={ResearchMs} outcome={Outcome} availability={Availability} failureStage={FailureStage}.",
                deterministicInspection.Identity.Mint,
                ElapsedMilliseconds(totalStopwatch),
                deterministicInspectionMs,
                researchMs,
                outcome.Status,
                outcome.Availability,
                outcome.FailureStage);
            return TokenInspectionResult.Success(
                deterministicInspection,
                MapResearchStatus(outcome));
        }

        var withResearchContext = deterministicInspection with
        {
            ProtocolContext = outcome.Context
        };

        var reviewSignals = TokenReviewSignalFactory.Create(withResearchContext);
        _logger.LogInformation(
            "Token analysis timing for mint {Mint}: totalMs={TotalMs} deterministicInspectionMs={DeterministicInspectionMs} researchMs={ResearchMs} outcome={Outcome} availability={Availability}.",
            deterministicInspection.Identity.Mint,
            ElapsedMilliseconds(totalStopwatch),
            deterministicInspectionMs,
            researchMs,
            outcome.Status,
            outcome.Availability);

        return TokenInspectionResult.Success(withResearchContext with
        {
            ReviewSignals = reviewSignals
        },
        MapResearchStatus(outcome));
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
