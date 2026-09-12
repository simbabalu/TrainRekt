using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

internal static class ResearchTestData
{
    public static TokenInspection CreateInspection(
        bool mintAuthorityRevoked = false,
        bool freezeAuthorityRevoked = true,
        decimal? largestUnknownTokenAccountPercentage = null,
        ProtocolResearchContext? protocolContext = null)
    {
        return new TokenInspection(
            Identity: new TokenIdentity(
                Mint: "ResearchMint1111111111111111111111111111111",
                Name: "Research Token",
                Symbol: "RCH",
                Decimals: 6,
                SupplyRaw: "1000000",
                ProgramId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                MetadataUri: null),
            Authorities: new TokenAuthorities(
                MintAuthority: mintAuthorityRevoked ? null : "MintAuth1111111111111111111111111111111",
                MintAuthorityRevoked: mintAuthorityRevoked,
                FreezeAuthority: freezeAuthorityRevoked ? null : "FreezeAuth11111111111111111111111111111",
                FreezeAuthorityRevoked: freezeAuthorityRevoked),
            Program: new TokenProgramInfo(
                ProgramType: "spl-token",
                ProgramId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                Token2022Extensions: Array.Empty<string>()),
            Age: new TokenAgeInfo(
                AgeSeconds: null,
                InferredCreatedAtUtc: null,
                IsReliable: false,
                UnavailableReason: "n/a"),
            HolderConcentration: new HolderConcentration(
                TopHolderPercentage: null,
                Top5HoldersPercentage: null,
                Top10HoldersPercentage: null,
                SemanticsNote: "n/a",
                UnclassifiedTokenAccountConcentration: new UnclassifiedTokenAccountConcentration(
                    ClassifiedProtocolPercentage: 0m,
                    UnknownPercentageWithinReportedLargestAccounts: largestUnknownTokenAccountPercentage,
                    LargestUnknownTokenAccountPercentage: largestUnknownTokenAccountPercentage,
                    Top5UnknownTokenAccountsPercentage: largestUnknownTokenAccountPercentage,
                    SemanticsNote: "n/a")),
            LargestTokenAccounts: Array.Empty<AnalyzedTokenAccount>(),
            PumpFunContext: null,
            ProtocolContext: protocolContext,
            ReviewSignals: Array.Empty<TokenReviewSignal>(),
            InspectedAtUtc: DateTimeOffset.UtcNow);
    }
}
