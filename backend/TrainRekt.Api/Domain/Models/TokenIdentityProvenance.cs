using System.Text.Json.Serialization;

namespace TrainRekt.Api.Domain.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TokenIdentityProvenanceResultType
{
    NoMeaningfulCollisionFound,
    CollisionObserved,
    Ambiguous,
    InsufficientEvidence
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TokenIdentityProvenanceConfidence
{
    None,
    Low,
    Medium,
    High
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TokenIdentityMatchDimension
{
    Name,
    Symbol
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TokenIdentityMatchLevel
{
    Exact,
    NormalizedExact
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TokenIdentityProvenanceUnknown
{
    GlobalHistoryNotChecked,
    OnChainCreationOrderNotVerified,
    OfficialIdentityNotVerified,
    SocialTrendNotAnalyzed,
    CopycatStatusNotDetermined,
    ScannedIdentityFieldsMissing,
    CanonicalCreationTimeNotProven,
    ChainHistoryPartial,
    ChainHistoryUnavailable,
    BlockTimeUnavailable,
    ProviderRetentionUnknown
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OnChainChronologyCoverage
{
    CompleteWithinProviderResult,
    PartialPageLimit,
    PartialSignatureLimit,
    PartialProviderFailure,
    PartialTimeout,
    Unavailable
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OnChainChronologyPrecision
{
    BlockTime,
    SlotOnly,
    ObservedTransactionOnly
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OnChainChronologyConfidence
{
    None,
    Low,
    Medium,
    High
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OnChainChronologyUnknown
{
    CanonicalCreationTimeNotProven,
    ChainHistoryPartial,
    ChainHistoryUnavailable,
    BlockTimeUnavailable,
    ProviderRetentionUnknown
}

public sealed record TokenIdentityProvenanceScannedIdentity(
    string Mint,
    string? RawName,
    string? NormalizedName,
    string? RawSymbol,
    string? NormalizedSymbol,
    DateTimeOffset ObservedAtUtc);

public sealed record TokenIdentityCollision(
    string CandidateMint,
    string? RawName,
    string? RawSymbol,
    IReadOnlyList<TokenIdentityMatchDimension> MatchDimensions,
    TokenIdentityMatchLevel MatchLevel,
    DateTimeOffset FirstObservedAtUtc,
    DateTimeOffset LastObservedAtUtc);

public sealed record EarliestObservedIdentityMatch(
    string Mint,
    DateTimeOffset ObservedAtUtc,
    string Semantics);

public sealed record TokenIdentityProvenanceEvidence(
    string Id,
    string Detail);

public sealed record OnChainChronologyEvidence(
    string? EarliestObservedSignature,
    long? EarliestObservedSlot,
    DateTimeOffset? EarliestObservedBlockTimeUtc,
    OnChainChronologyCoverage HistoryCoverage,
    bool PaginationExhausted,
    int PagesScanned,
    int SignaturesScanned,
    string Source,
    OnChainChronologyConfidence Confidence,
    OnChainChronologyPrecision Precision,
    bool AccountCreationProven,
    IReadOnlyList<OnChainChronologyUnknown> Unknowns,
    DateTimeOffset AnalyzedAtUtc);

public sealed record TokenIdentityProvenance(
    TokenIdentityProvenanceResultType Result,
    TokenIdentityProvenanceConfidence Confidence,
    TokenIdentityProvenanceScannedIdentity ScannedIdentity,
    EarliestObservedIdentityMatch? EarliestObservedMatch,
    IReadOnlyList<TokenIdentityCollision> Collisions,
    int TotalCollisionCount,
    int ReturnedCollisionCount,
    bool IsTruncated,
    IReadOnlyList<TokenIdentityProvenanceEvidence> Evidence,
    IReadOnlyList<TokenIdentityProvenanceEvidence> ConflictingEvidence,
    IReadOnlyList<TokenIdentityProvenanceUnknown> Unknowns,
    DateTimeOffset AnalyzedAtUtc,
    OnChainChronologyEvidence? OnChainChronology = null);
