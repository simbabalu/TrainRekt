using TrainRekt.Api.Domain.Analysis;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenProtocolContextFactoryTests
{
    [Fact]
    public void Create_CanonicalSkrMintWithActiveMintAuthority_EmitsDocumentedIssuanceContextAndPreservesRawAuthorityFact()
    {
        var inspection = CreateInspection(
            mint: ProtocolConstants.SolanaMobileSkrMint,
            mintAuthority: "SomeAuthority",
            mintAuthorityRevoked: false,
            symbol: "SKR",
            name: "Solana Mobile SKR");

        var context = TokenProtocolContextFactory.Create(inspection);

        Assert.NotNull(context);
        Assert.Equal(ProtocolConstants.SolanaMobileSkrProtocolName, context.Protocol);
        Assert.NotNull(context.Issuance);
        Assert.Equal("documented_inflationary_issuance", context.Issuance.Classification);
        Assert.Equal("official_documentation", context.Issuance.Verification);
        Assert.False(context.Issuance.MintAuthorityIdentityVerified);
        Assert.Equal("SomeAuthority", inspection.Authorities.MintAuthority);
        Assert.False(inspection.Authorities.MintAuthorityRevoked);
    }

    [Fact]
    public void Create_GenericActiveMintAuthorityToken_DoesNotReceiveSkrContext()
    {
        var inspection = CreateInspection(
            mint: KeyFromByte(11),
            mintAuthority: "GenericAuthority",
            mintAuthorityRevoked: false,
            symbol: "GEN",
            name: "Generic Token");

        var context = TokenProtocolContextFactory.Create(inspection);

        Assert.Null(context);
    }

    [Fact]
    public void Create_SkrLikeSymbolButDifferentMint_DoesNotReceiveSkrContext()
    {
        var inspection = CreateInspection(
            mint: KeyFromByte(12),
            mintAuthority: "LookalikeAuthority",
            mintAuthorityRevoked: false,
            symbol: "SKR",
            name: "Solana Mobile SKR");

        var context = TokenProtocolContextFactory.Create(inspection);

        Assert.Null(context);
    }

    private static TokenInspection CreateInspection(
        string mint,
        string? mintAuthority,
        bool mintAuthorityRevoked,
        string symbol,
        string name)
    {
        return new TokenInspection(
            Identity: new TokenIdentity(
                Mint: mint,
                Name: name,
                Symbol: symbol,
                Decimals: 6,
                SupplyRaw: "1000000",
                ProgramId: SolanaTokenConstants.SplTokenProgramId,
                MetadataUri: null),
            Authorities: new TokenAuthorities(
                MintAuthority: mintAuthority,
                MintAuthorityRevoked: mintAuthorityRevoked,
                FreezeAuthority: null,
                FreezeAuthorityRevoked: true),
            Program: new TokenProgramInfo(
                ProgramType: "spl-token",
                ProgramId: SolanaTokenConstants.SplTokenProgramId,
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
                UnclassifiedTokenAccountConcentration: null),
            LargestTokenAccounts: Array.Empty<AnalyzedTokenAccount>(),
            PumpFunContext: null,
            ProtocolContext: null,
            ReviewSignals: Array.Empty<TokenReviewSignal>(),
            InspectedAtUtc: DateTimeOffset.UtcNow);
    }

    private static string KeyFromByte(byte value)
    {
        return TrainRekt.Api.Domain.Utils.Base58Codec.Encode(Enumerable.Repeat(value, 32).ToArray());
    }
}
