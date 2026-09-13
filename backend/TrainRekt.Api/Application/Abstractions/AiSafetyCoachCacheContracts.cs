namespace TrainRekt.Api.Application.Abstractions;

public sealed record CachedTokenInspectionCoachSnapshot(
    string Id,
    string Mint,
    string Language,
    int CoachVersion,
    string InputFingerprint,
    DateTimeOffset CachedAtUtc,
    DateTimeOffset ExpiresAtUtc,
    AiSafetyCoachPayload Coach);

public interface IAiSafetyCoachSnapshotRepository
{
    Task<CachedTokenInspectionCoachSnapshot?> GetFreshAsync(
        string mint,
        string language,
        int coachVersion,
        string inputFingerprint,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken);

    Task InsertAsync(CachedTokenInspectionCoachSnapshot snapshot, CancellationToken cancellationToken);
}