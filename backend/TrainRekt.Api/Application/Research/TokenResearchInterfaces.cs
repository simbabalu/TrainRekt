using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public interface ITokenResearchProvider
{
    Task<ResearchProviderResult> ResearchAsync(ResearchRequest request, CancellationToken cancellationToken);
}

public interface IResearchTrustAssessor
{
    Task<ResearchTrustAssessment> AssessAsync(
        ResearchRequest request,
        CandidateResearchResult candidate,
        CancellationToken cancellationToken);
}

public interface ITokenResearchOrchestrator
{
    Task<ResearchOutcome> RunAsync(TokenInspection inspection, CancellationToken cancellationToken);

    Task<ResearchOutcome> RunCacheOnlyAsync(TokenInspection inspection, CancellationToken cancellationToken);
}
