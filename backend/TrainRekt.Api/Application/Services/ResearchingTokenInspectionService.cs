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
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Research enrichment failed for mint {Mint}. Returning deterministic inspection.",
                deterministicInspection.Identity.Mint);
            return deterministicResult;
        }

        if (outcome.Status != ResearchOutcomeStatus.Completed || outcome.Context is null)
        {
            return deterministicResult;
        }

        var withResearchContext = deterministicInspection with
        {
            ProtocolContext = outcome.Context
        };

        var reviewSignals = TokenReviewSignalFactory.Create(withResearchContext);
        return TokenInspectionResult.Success(withResearchContext with
        {
            ReviewSignals = reviewSignals
        });
    }
}
