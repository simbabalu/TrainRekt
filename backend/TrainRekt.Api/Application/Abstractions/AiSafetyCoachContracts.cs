using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public sealed record AiSafetyCoachInput(
    string? TokenName,
    string? TokenSymbol,
    string TokenProgram,
    AiSafetyCoachAgeInput Age,
    AiSafetyCoachAuthorityInput Authorities,
    AiSafetyCoachConcentrationInput Concentration,
    IReadOnlyList<AiSafetyCoachProtocolBreakdownItem> ProtocolBreakdown,
    string DeterministicStatus,
    IReadOnlyList<AiSafetyCoachReviewSignalInput> ReviewSignals,
    IReadOnlyList<AiSafetyCoachClaimSummaryInput> TrustedClaimSummaries,
    IReadOnlyList<string> UncertaintyMarkers,
    AiSafetyCoachIdentityInput? Identity = null,
    AiSafetyCoachExternalContextInput? ExternalContext = null);

public sealed record AiSafetyCoachExternalContextInput(
    string Availability,
    string AssetType,
    string? ProjectName,
    string? Summary,
    string Confidence,
    bool MintConfirmed,
    bool AmbiguousIdentity,
    IReadOnlyList<AiSafetyCoachExternalContextEvidenceInput> Evidence);

public sealed record AiSafetyCoachExternalContextEvidenceInput(
    string SourceType,
    string Title,
    string Domain,
    string Claim,
    string? Url);

public sealed record AiSafetyCoachIdentityInput(
    string Classification,
    string Confidence,
    bool HasMeaningfulCollision,
    string IdentityMatchStrength,
    bool? ScannedAppearsLaterOnChain,
    bool ChronologyComparisonComplete,
    bool TrustedSourceReferencesCompetingMint,
    bool TrustedSourceReferencesScannedMint,
    bool TrustedIdentityConflict,
    bool CopyingIntentNotProven,
    bool GlobalFirstTokenNotProven,
    bool ProviderHistoryMayBeIncomplete,
    bool SocialContextNotAnalyzed);

public sealed record AiSafetyCoachAgeInput(
    long? AgeSeconds,
    bool IsReliable,
    string? UnavailableReason);

public sealed record AiSafetyCoachAuthorityInput(
    bool MintAuthorityRevoked,
    bool FreezeAuthorityRevoked);

public sealed record AiSafetyCoachConcentrationInput(
    decimal? TopHolderPercentage,
    decimal? Top5HoldersPercentage,
    decimal? Top10HoldersPercentage,
    string SemanticsNote,
    decimal? ClassifiedProtocolPercentage,
    decimal? UnknownPercentageWithinReportedLargestAccounts,
    decimal? LargestUnknownTokenAccountPercentage,
    decimal? Top5UnknownTokenAccountsPercentage,
    string? UnclassifiedSemanticsNote);

public sealed record AiSafetyCoachProtocolBreakdownItem(
    string Protocol,
    string Role,
    string Confidence,
    decimal? Percentage,
    int AccountCount);

public sealed record AiSafetyCoachReviewSignalInput(
    string Id,
    string Category,
    string Severity,
    string Explanation,
    IReadOnlyList<AiSafetyCoachEvidencePair> Evidence);

public sealed record AiSafetyCoachEvidencePair(string Key, string Value);

public sealed record AiSafetyCoachClaimSummaryInput(
    string Id,
    string Category,
    string Statement,
    ResearchClaimVerificationStatus VerificationStatus,
    ResearchClaimVerificationMethod VerificationMethod,
    ObservedConsistency Consistency,
    int SourceCount,
    IReadOnlyList<string> SourcePublishers);

public sealed record AiSafetyCoachContent(
    string Summary,
    IReadOnlyList<string> RiskExplanations,
    IReadOnlyList<string> WhatToCheckNext,
    IReadOnlyList<string> Uncertainty,
    string? RecommendedTrainingTopicId);

public sealed record AiSafetyCoachPayload(
    AiSafetyCoachContent Content,
    int CoachVersion,
    DateTimeOffset GeneratedAtUtc);

public enum AiSafetyCoachFailureReason
{
    Disabled,
    MissingApiKey,
    Timeout,
    RateLimited,
    ProviderUnavailable,
    ProviderRejected,
    OutputTruncated,
    MalformedResponse,
    SchemaViolation,
    ValidationFailed,
    Unknown
}

public sealed record AiSafetyCoachModelResult(
    bool Success,
    AiSafetyCoachContent? Content,
    AiSafetyCoachFailureReason? FailureReason,
    string? Detail,
    int? HttpStatusCode = null);

public interface IAiSafetyCoach
{
    Task<AiSafetyCoachModelResult> GenerateAsync(AiSafetyCoachInput input, CancellationToken cancellationToken);
}

public enum AiSafetyCoachStatus
{
    Available,
    Disabled,
    Unavailable,
    InvalidResponse,
    CacheUnavailable
}

public sealed record TokenInspectionCoachResult(
    TokenInspectionError? InspectionError,
    AiSafetyCoachStatus Status,
    AiSafetyCoachPayload? Coach)
{
    public bool Available => Coach is not null;
}

public interface ITokenInspectionCoachService
{
    Task<TokenInspectionCoachResult> GenerateAsync(string mint, CancellationToken cancellationToken);
}