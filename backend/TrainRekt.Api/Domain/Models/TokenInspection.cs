namespace TrainRekt.Api.Domain.Models;

public sealed record TokenInspection(
    TokenIdentity Identity,
    TokenAuthorities Authorities,
    TokenProgramInfo Program,
    TokenAgeInfo Age,
    HolderConcentration HolderConcentration,
    IReadOnlyList<AnalyzedTokenAccount> LargestTokenAccounts,
    PumpFunContext? PumpFunContext,
    ProtocolResearchContext? ProtocolContext,
    IReadOnlyList<TokenReviewSignal> ReviewSignals,
    DateTimeOffset InspectedAtUtc);
