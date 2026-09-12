using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public sealed record CachedToken(
    string Mint,
    string? Name,
    string? Symbol,
    string ProgramId,
    DateTimeOffset FirstSeenAtUtc,
    DateTimeOffset LastSeenAtUtc);

public sealed record CachedTokenInspectionSnapshot(
    string Id,
    string Mint,
    DateTimeOffset InspectedAtUtc,
    DateTimeOffset CachedAtUtc,
    int AnalysisVersion,
    DateTimeOffset ExpiresAtUtc,
    TokenInspection Result);

public interface ITokenRepository
{
    Task<CachedToken?> GetByMintAsync(string mint, CancellationToken cancellationToken);

    Task UpsertAsync(CachedToken token, CancellationToken cancellationToken);
}

public interface ITokenInspectionSnapshotRepository
{
    Task<CachedTokenInspectionSnapshot?> GetLatestFreshAsync(
        string mint,
        int analysisVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken);

    Task<CachedTokenInspectionSnapshot?> GetLatestByMintAsync(
        string mint,
        CancellationToken cancellationToken);

    Task InsertAsync(CachedTokenInspectionSnapshot snapshot, CancellationToken cancellationToken);
}
