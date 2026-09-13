using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Api.Contracts;

public sealed record TokenInspectionRequest(string Mint);

public sealed record TokenInspectionResponse(
    TokenIdentity Identity,
    TokenAuthorities Authorities,
    TokenProgramInfo Program,
    TokenAgeInfo Age,
    HolderConcentration HolderConcentration,
    IReadOnlyList<AnalyzedTokenAccount> LargestTokenAccounts,
    PumpFunContext? PumpFunContext,
    ProtocolResearchContext? ProtocolContext,
    IReadOnlyList<TokenReviewSignal> ReviewSignals,
    DateTimeOffset InspectedAtUtc)
{
    public static TokenInspectionResponse FromDomain(TokenInspection inspection)
    {
        return new TokenInspectionResponse(
            Identity: inspection.Identity,
            Authorities: inspection.Authorities,
            Program: inspection.Program,
            Age: inspection.Age,
            HolderConcentration: inspection.HolderConcentration,
            LargestTokenAccounts: inspection.LargestTokenAccounts,
            PumpFunContext: inspection.PumpFunContext,
            ProtocolContext: inspection.ProtocolContext,
            ReviewSignals: inspection.ReviewSignals,
            InspectedAtUtc: inspection.InspectedAtUtc);
    }
}

public sealed record TokenInspectionCoachResponse(
    bool Available,
    string Status,
    TokenInspectionCoachContentResponse? Coach)
{
    public static TokenInspectionCoachResponse FromDomain(TokenInspectionCoachResult result)
    {
        return new TokenInspectionCoachResponse(
            Available: result.Available,
            Status: ToStatusValue(result.Status),
            Coach: result.Coach is null ? null : TokenInspectionCoachContentResponse.FromDomain(result.Coach));
    }

    private static string ToStatusValue(AiSafetyCoachStatus status)
    {
        return status switch
        {
            AiSafetyCoachStatus.Available => "available",
            AiSafetyCoachStatus.Disabled => "disabled",
            AiSafetyCoachStatus.InvalidResponse => "invalid-response",
            AiSafetyCoachStatus.CacheUnavailable => "cache-unavailable",
            _ => "unavailable"
        };
    }
}

public sealed record TokenInspectionCoachContentResponse(
    string Summary,
    IReadOnlyList<string> RiskExplanations,
    IReadOnlyList<string> WhatToCheckNext,
    IReadOnlyList<string> Uncertainty,
    string? RecommendedTrainingTopicId,
    int CoachVersion,
    DateTimeOffset GeneratedAtUtc)
{
    public static TokenInspectionCoachContentResponse FromDomain(AiSafetyCoachPayload payload)
    {
        return new TokenInspectionCoachContentResponse(
            Summary: payload.Content.Summary,
            RiskExplanations: payload.Content.RiskExplanations,
            WhatToCheckNext: payload.Content.WhatToCheckNext,
            Uncertainty: payload.Content.Uncertainty,
            RecommendedTrainingTopicId: payload.Content.RecommendedTrainingTopicId,
            CoachVersion: payload.CoachVersion,
            GeneratedAtUtc: payload.GeneratedAtUtc);
    }
}

public sealed record TokenIdentityProvenanceResponse(
    string Result,
    string Confidence,
    TokenIdentityProvenanceScannedIdentityResponse ScannedIdentity,
    EarliestObservedIdentityMatchResponse? EarliestObservedMatch,
    IReadOnlyList<TokenIdentityCollisionResponse> Collisions,
    int TotalCollisionCount,
    int ReturnedCollisionCount,
    bool IsTruncated,
    IReadOnlyList<TokenIdentityProvenanceEvidenceResponse> Evidence,
    IReadOnlyList<TokenIdentityProvenanceEvidenceResponse> ConflictingEvidence,
    IReadOnlyList<string> Unknowns,
    DateTimeOffset AnalyzedAtUtc,
    OnChainChronologyEvidenceResponse? OnChainChronology)
{
    public static TokenIdentityProvenanceResponse FromDomain(TokenIdentityProvenance provenance)
    {
        return new TokenIdentityProvenanceResponse(
            Result: ToResultValue(provenance.Result),
            Confidence: ToConfidenceValue(provenance.Confidence),
            ScannedIdentity: TokenIdentityProvenanceScannedIdentityResponse.FromDomain(provenance.ScannedIdentity),
            EarliestObservedMatch: provenance.EarliestObservedMatch is null
                ? null
                : EarliestObservedIdentityMatchResponse.FromDomain(provenance.EarliestObservedMatch),
            Collisions: provenance.Collisions.Select(TokenIdentityCollisionResponse.FromDomain).ToArray(),
            TotalCollisionCount: provenance.TotalCollisionCount,
            ReturnedCollisionCount: provenance.ReturnedCollisionCount,
            IsTruncated: provenance.IsTruncated,
            Evidence: provenance.Evidence.Select(TokenIdentityProvenanceEvidenceResponse.FromDomain).ToArray(),
            ConflictingEvidence: provenance.ConflictingEvidence.Select(TokenIdentityProvenanceEvidenceResponse.FromDomain).ToArray(),
            Unknowns: provenance.Unknowns.Select(ToUnknownValue).ToArray(),
            AnalyzedAtUtc: provenance.AnalyzedAtUtc,
            OnChainChronology: provenance.OnChainChronology is null
                ? null
                : OnChainChronologyEvidenceResponse.FromDomain(provenance.OnChainChronology));
    }

    private static string ToResultValue(TokenIdentityProvenanceResultType value)
    {
        return value switch
        {
            TokenIdentityProvenanceResultType.NoMeaningfulCollisionFound => "NO_MEANINGFUL_COLLISION_FOUND",
            TokenIdentityProvenanceResultType.CollisionObserved => "COLLISION_OBSERVED",
            TokenIdentityProvenanceResultType.Ambiguous => "AMBIGUOUS",
            _ => "INSUFFICIENT_EVIDENCE"
        };
    }

    private static string ToConfidenceValue(TokenIdentityProvenanceConfidence value)
    {
        return value switch
        {
            TokenIdentityProvenanceConfidence.High => "HIGH",
            TokenIdentityProvenanceConfidence.Medium => "MEDIUM",
            TokenIdentityProvenanceConfidence.Low => "LOW",
            _ => "NONE"
        };
    }

    private static string ToUnknownValue(TokenIdentityProvenanceUnknown value)
    {
        return value switch
        {
            TokenIdentityProvenanceUnknown.GlobalHistoryNotChecked => "GLOBAL_HISTORY_NOT_CHECKED",
            TokenIdentityProvenanceUnknown.OnChainCreationOrderNotVerified => "ON_CHAIN_CREATION_ORDER_NOT_VERIFIED",
            TokenIdentityProvenanceUnknown.OfficialIdentityNotVerified => "OFFICIAL_IDENTITY_NOT_VERIFIED",
            TokenIdentityProvenanceUnknown.SocialTrendNotAnalyzed => "SOCIAL_TREND_NOT_ANALYZED",
            TokenIdentityProvenanceUnknown.CopycatStatusNotDetermined => "COPYCAT_STATUS_NOT_DETERMINED",
            TokenIdentityProvenanceUnknown.ScannedIdentityFieldsMissing => "SCANNED_IDENTITY_FIELDS_MISSING",
            TokenIdentityProvenanceUnknown.CanonicalCreationTimeNotProven => "CANONICAL_CREATION_TIME_NOT_PROVEN",
            TokenIdentityProvenanceUnknown.ChainHistoryPartial => "CHAIN_HISTORY_PARTIAL",
            TokenIdentityProvenanceUnknown.ChainHistoryUnavailable => "CHAIN_HISTORY_UNAVAILABLE",
            TokenIdentityProvenanceUnknown.BlockTimeUnavailable => "BLOCK_TIME_UNAVAILABLE",
            _ => "PROVIDER_RETENTION_UNKNOWN"
        };
    }
}

public sealed record OnChainChronologyEvidenceResponse(
    string? EarliestObservedSignature,
    long? EarliestObservedSlot,
    DateTimeOffset? EarliestObservedBlockTimeUtc,
    string HistoryCoverage,
    bool PaginationExhausted,
    int PagesScanned,
    int SignaturesScanned,
    string Source,
    string Confidence,
    string Precision,
    bool AccountCreationProven,
    IReadOnlyList<string> Unknowns,
    DateTimeOffset AnalyzedAtUtc)
{
    public static OnChainChronologyEvidenceResponse FromDomain(OnChainChronologyEvidence evidence)
    {
        return new OnChainChronologyEvidenceResponse(
            EarliestObservedSignature: evidence.EarliestObservedSignature,
            EarliestObservedSlot: evidence.EarliestObservedSlot,
            EarliestObservedBlockTimeUtc: evidence.EarliestObservedBlockTimeUtc,
            HistoryCoverage: ToCoverageValue(evidence.HistoryCoverage),
            PaginationExhausted: evidence.PaginationExhausted,
            PagesScanned: evidence.PagesScanned,
            SignaturesScanned: evidence.SignaturesScanned,
            Source: evidence.Source,
            Confidence: ToConfidenceValue(evidence.Confidence),
            Precision: ToPrecisionValue(evidence.Precision),
            AccountCreationProven: evidence.AccountCreationProven,
            Unknowns: evidence.Unknowns.Select(ToUnknownValue).ToArray(),
            AnalyzedAtUtc: evidence.AnalyzedAtUtc);
    }

    private static string ToCoverageValue(OnChainChronologyCoverage value)
    {
        return value switch
        {
            OnChainChronologyCoverage.CompleteWithinProviderResult => "COMPLETE_WITHIN_PROVIDER_RESULT",
            OnChainChronologyCoverage.PartialPageLimit => "PARTIAL_PAGE_LIMIT",
            OnChainChronologyCoverage.PartialSignatureLimit => "PARTIAL_SIGNATURE_LIMIT",
            OnChainChronologyCoverage.PartialProviderFailure => "PARTIAL_PROVIDER_FAILURE",
            OnChainChronologyCoverage.PartialTimeout => "PARTIAL_TIMEOUT",
            _ => "UNAVAILABLE"
        };
    }

    private static string ToConfidenceValue(OnChainChronologyConfidence value)
    {
        return value switch
        {
            OnChainChronologyConfidence.High => "HIGH",
            OnChainChronologyConfidence.Medium => "MEDIUM",
            OnChainChronologyConfidence.Low => "LOW",
            _ => "NONE"
        };
    }

    private static string ToPrecisionValue(OnChainChronologyPrecision value)
    {
        return value switch
        {
            OnChainChronologyPrecision.BlockTime => "BLOCK_TIME",
            OnChainChronologyPrecision.SlotOnly => "SLOT_ONLY",
            _ => "OBSERVED_TRANSACTION_ONLY"
        };
    }

    private static string ToUnknownValue(OnChainChronologyUnknown value)
    {
        return value switch
        {
            OnChainChronologyUnknown.CanonicalCreationTimeNotProven => "CANONICAL_CREATION_TIME_NOT_PROVEN",
            OnChainChronologyUnknown.ChainHistoryPartial => "CHAIN_HISTORY_PARTIAL",
            OnChainChronologyUnknown.ChainHistoryUnavailable => "CHAIN_HISTORY_UNAVAILABLE",
            OnChainChronologyUnknown.BlockTimeUnavailable => "BLOCK_TIME_UNAVAILABLE",
            _ => "PROVIDER_RETENTION_UNKNOWN"
        };
    }
}

public sealed record TokenIdentityProvenanceScannedIdentityResponse(
    string Mint,
    string? RawName,
    string? NormalizedName,
    string? RawSymbol,
    string? NormalizedSymbol,
    DateTimeOffset ObservedAtUtc)
{
    public static TokenIdentityProvenanceScannedIdentityResponse FromDomain(TokenIdentityProvenanceScannedIdentity value)
    {
        return new TokenIdentityProvenanceScannedIdentityResponse(
            Mint: value.Mint,
            RawName: value.RawName,
            NormalizedName: value.NormalizedName,
            RawSymbol: value.RawSymbol,
            NormalizedSymbol: value.NormalizedSymbol,
            ObservedAtUtc: value.ObservedAtUtc);
    }
}

public sealed record EarliestObservedIdentityMatchResponse(
    string Mint,
    DateTimeOffset ObservedAtUtc,
    string Semantics)
{
    public static EarliestObservedIdentityMatchResponse FromDomain(EarliestObservedIdentityMatch value)
    {
        return new EarliestObservedIdentityMatchResponse(
            Mint: value.Mint,
            ObservedAtUtc: value.ObservedAtUtc,
            Semantics: value.Semantics);
    }
}

public sealed record TokenIdentityCollisionResponse(
    string CandidateMint,
    string? RawName,
    string? RawSymbol,
    IReadOnlyList<string> MatchDimensions,
    string MatchLevel,
    DateTimeOffset FirstObservedAtUtc,
    DateTimeOffset LastObservedAtUtc)
{
    public static TokenIdentityCollisionResponse FromDomain(TokenIdentityCollision value)
    {
        return new TokenIdentityCollisionResponse(
            CandidateMint: value.CandidateMint,
            RawName: value.RawName,
            RawSymbol: value.RawSymbol,
            MatchDimensions: value.MatchDimensions.Select(ToDimensionValue).ToArray(),
            MatchLevel: value.MatchLevel == TokenIdentityMatchLevel.Exact ? "EXACT" : "NORMALIZED_EXACT",
            FirstObservedAtUtc: value.FirstObservedAtUtc,
            LastObservedAtUtc: value.LastObservedAtUtc);
    }

    private static string ToDimensionValue(TokenIdentityMatchDimension value)
    {
        return value == TokenIdentityMatchDimension.Name ? "NAME" : "SYMBOL";
    }
}

public sealed record TokenIdentityProvenanceEvidenceResponse(
    string Id,
    string Detail)
{
    public static TokenIdentityProvenanceEvidenceResponse FromDomain(TokenIdentityProvenanceEvidence value)
    {
        return new TokenIdentityProvenanceEvidenceResponse(value.Id, value.Detail);
    }
}
