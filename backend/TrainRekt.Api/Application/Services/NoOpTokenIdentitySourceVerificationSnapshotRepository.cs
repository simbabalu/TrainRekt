using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

public sealed class NoOpTokenIdentitySourceVerificationSnapshotRepository : ITokenIdentitySourceVerificationSnapshotRepository
{
    public Task<CachedTokenIdentitySourceVerificationSnapshot?> GetFreshAsync(
        string canonicalUrl,
        string relevantMintSetFingerprint,
        int identityProvenanceVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<CachedTokenIdentitySourceVerificationSnapshot?>(null);
    }

    public Task InsertAsync(CachedTokenIdentitySourceVerificationSnapshot snapshot, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
