using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

public sealed class NoOpTokenIdentityChronologySnapshotRepository : ITokenIdentityChronologySnapshotRepository
{
    public Task<CachedTokenIdentityChronologySnapshot?> GetFreshAsync(
        string mint,
        int chronologyVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<CachedTokenIdentityChronologySnapshot?>(null);
    }

    public Task InsertAsync(CachedTokenIdentityChronologySnapshot snapshot, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
