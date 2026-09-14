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
        var deterministicResult = await _innerService.InspectAsync(mint, cancellationToken);
        if (deterministicResult.Error is not null || deterministicResult.Inspection is null)
        {
            return deterministicResult;
        }

        var deterministicInspection = deterministicResult.Inspection;
        ResearchOutcome outcome;
        try
        {
            outcome = await _researchOrchestrator.RunAsync(deterministicInspection, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning(
                "Optional research timed out for mint {Mint}. Returning deterministic inspection.",
                deterministicInspection.Identity.Mint);

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
            _logger.LogWarning(
                exception,
                "Research enrichment failed for mint {Mint}. Returning deterministic inspection.",
                deterministicInspection.Identity.Mint);

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
            return TokenInspectionResult.Success(
                deterministicInspection,
                MapResearchStatus(outcome));
        }

        var withResearchContext = deterministicInspection with
        {
            ProtocolContext = outcome.Context
        };

        var reviewSignals = TokenReviewSignalFactory.Create(withResearchContext);
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
}
