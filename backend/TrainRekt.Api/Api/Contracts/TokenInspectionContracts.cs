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
