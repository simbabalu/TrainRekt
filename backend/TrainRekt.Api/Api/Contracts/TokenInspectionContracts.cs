using TrainRekt.Api.Domain.Models;

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
    TokenProtocolContext? ProtocolContext,
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
