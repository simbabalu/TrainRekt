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

public sealed record TrustedIdentityProvenanceRequest(
    string ScannedMint,
    string? ScannedMetadataUri,
    IReadOnlyList<TokenIdentityCollision> Collisions,
    DateTimeOffset AnalyzedAtUtc);

public sealed record CachedTokenIdentitySourceVerificationSnapshot(
    string Id,
    string CanonicalUrl,
    string RelevantMintSetFingerprint,
    int IdentityProvenanceVersion,
    DateTimeOffset AnalyzedAtUtc,
    DateTimeOffset CachedAtUtc,
    DateTimeOffset ExpiresAtUtc,
    IdentitySourceEvidence SourceEvidence,
    IReadOnlyList<TokenIdentityProvenanceEvidence> Evidence,
    IReadOnlyList<TokenIdentityProvenanceEvidence> Conflicts,
    IReadOnlyList<TrustedIdentityProvenanceUnknown> Unknowns);

public interface ITokenIdentitySourceVerificationSnapshotRepository
{
    Task<CachedTokenIdentitySourceVerificationSnapshot?> GetFreshAsync(
        string canonicalUrl,
        string relevantMintSetFingerprint,
        int identityProvenanceVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken);

    Task InsertAsync(CachedTokenIdentitySourceVerificationSnapshot snapshot, CancellationToken cancellationToken);
}

public interface ITrustedIdentityProvenanceService
{
    Task<TrustedIdentityProvenance> AnalyzeAsync(
        TrustedIdentityProvenanceRequest request,
        CancellationToken cancellationToken);
}

public interface ITokenIdentityClassifier
{
    TokenIdentityClassification Classify(TokenIdentityProvenance provenance);
}

public interface ITokenIdentityProvenanceService
{
    Task<TokenIdentityProvenanceResult> AnalyzeAsync(string mint, CancellationToken cancellationToken);

    Task<TokenIdentityProvenanceResult> AnalyzeFromInspectionAsync(TokenInspection inspection, CancellationToken cancellationToken);
}
