namespace TrainRekt.Api.Application.Research;

public sealed class NoOpResearchTrustAssessor : IResearchTrustAssessor
{
    public Task<ResearchTrustAssessment> AssessAsync(
        ResearchRequest request,
        CandidateResearchResult candidate,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var assessment = new ResearchTrustAssessment(
            Identity: new ResearchIdentityAssessment(
                Match: ResearchIdentityMatch.Unconfirmed,
                HasExactMintMatch: false,
                EvidenceNotes: new[] { "No trusted source resolver/assessor configured." }),
            Sources: Array.Empty<AssessedResearchSource>());

        return Task.FromResult(assessment);
    }
}
