namespace TrainRekt.Api.Application.Research;

public sealed class NoOpTokenResearchProvider : ITokenResearchProvider
{
    public Task<CandidateResearchResult> ResearchAsync(ResearchRequest request, CancellationToken cancellationToken)
    {
        var result = new CandidateResearchResult(
            IdentityEvidence: Array.Empty<CandidateIdentityEvidence>(),
            Sources: Array.Empty<CandidateResearchSource>(),
            Claims: Array.Empty<CandidateDocumentedClaim>());

        return Task.FromResult(result);
    }
}
