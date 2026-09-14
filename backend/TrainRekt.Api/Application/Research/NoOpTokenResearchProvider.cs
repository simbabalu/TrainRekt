namespace TrainRekt.Api.Application.Research;

public sealed class NoOpTokenResearchProvider : ITokenResearchProvider
{
    public Task<ResearchProviderResult> ResearchAsync(ResearchRequest request, CancellationToken cancellationToken)
    {
        var candidate = new CandidateResearchResult(
            IdentityEvidence: Array.Empty<CandidateIdentityEvidence>(),
            Sources: Array.Empty<CandidateResearchSource>(),
            Claims: Array.Empty<CandidateDocumentedClaim>());

        var result = new ResearchProviderResult(
            ResearchExecutionStatus.Unavailable,
            candidate,
            ResearchFailureCategory.Disabled,
            "provider",
            "Optional research provider is disabled.");

        return Task.FromResult(result);
    }
}
