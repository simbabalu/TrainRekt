using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

public sealed class NoOpAiSafetyCoachSnapshotRepository : IAiSafetyCoachSnapshotRepository
{
    public Task<CachedTokenInspectionCoachSnapshot?> GetFreshAsync(
        string mint,
        string language,
        int coachVersion,
        string inputFingerprint,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<CachedTokenInspectionCoachSnapshot?>(null);
    }

    public Task InsertAsync(CachedTokenInspectionCoachSnapshot snapshot, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}