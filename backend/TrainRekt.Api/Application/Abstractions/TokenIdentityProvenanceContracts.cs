using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public sealed record TokenIdentityObservation(
    string Mint,
    string? RawName,
    string? NormalizedName,
    string? RawSymbol,
    string? NormalizedSymbol,
    string? TokenProgram,
    DateTimeOffset FirstObservedAtUtc,
    DateTimeOffset LastObservedAtUtc,
    int ObservationVersion);

public sealed record TokenIdentityObservationQueryResult(
    int TotalCount,
    IReadOnlyList<TokenIdentityObservation> Observations);

public interface ITokenIdentityObservationRepository
{
    Task<TokenIdentityObservation?> GetByMintAsync(string mint, CancellationToken cancellationToken);

    Task UpsertAsync(TokenIdentityObservation observation, CancellationToken cancellationToken);

    Task<TokenIdentityObservationQueryResult> FindCollisionsAsync(
        string excludingMint,
        string? normalizedName,
        string? normalizedSymbol,
        int limit,
        CancellationToken cancellationToken);
}

public sealed record TokenIdentityProvenanceResult(
    TokenInspectionError? InspectionError,
    TokenIdentityProvenance? Provenance);

public sealed record CachedTokenIdentityChronologySnapshot(
    string Id,
    string Mint,
    int ChronologyVersion,
    DateTimeOffset AnalyzedAtUtc,
    DateTimeOffset CachedAtUtc,
    DateTimeOffset ExpiresAtUtc,
    OnChainChronologyEvidence Evidence);

public interface ITokenIdentityChronologySnapshotRepository
{
    Task<CachedTokenIdentityChronologySnapshot?> GetFreshAsync(
        string mint,
        int chronologyVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken);

    Task InsertAsync(CachedTokenIdentityChronologySnapshot snapshot, CancellationToken cancellationToken);
}

public interface IOnChainChronologyService
{
    Task<OnChainChronologyEvidence> AnalyzeAsync(string mint, CancellationToken cancellationToken);
}

public interface ITokenIdentityProvenanceService
{
    Task<TokenIdentityProvenanceResult> AnalyzeAsync(string mint, CancellationToken cancellationToken);
}
