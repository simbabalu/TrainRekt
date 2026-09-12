using TrainRekt.Api.Domain.Analysis;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class ProtocolResearchContextFactoryTests
{
    [Fact]
    public void Create_CanonicalSkrMintWithActiveMintAuthority_EmitsGenericClaimsAndSources()
    {
        var inspection = CreateInspection(
            mint: ProtocolConstants.SolanaMobileSkrMint,
            mintAuthority: "SomeAuthority",
            mintAuthorityRevoked: false,
            symbol: "SKR",
            name: "Solana Mobile SKR");

        var context = ProtocolResearchContextFactory.Create(inspection);

        Assert.NotNull(context);
        Assert.Equal(ProtocolConstants.SolanaMobileSkrProtocolName, context.Protocol);
        Assert.Equal(2, context.Sources.Count);
        Assert.Contains(context.Sources, source => source.Id == ProtocolConstants.SolanaMobileSkrTokenomicsSourceId && source.SourceType == ResearchSourceType.OfficialDocumentation);
        Assert.Contains(context.Sources, source => source.Id == ProtocolConstants.SolanaMobileSkrStakingIdlSourceId && source.SourceType == ResearchSourceType.OfficialIdl);

        var issuanceClaim = Assert.Single(context.Claims.Where(claim => claim.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE"));
        Assert.Equal(ResearchClaimVerificationStatus.Documented, issuanceClaim.VerificationStatus);
        Assert.Equal(ResearchClaimVerificationMethod.DocumentationOnly, issuanceClaim.VerificationMethod);
        Assert.Equal(ObservedConsistency.Consistent, issuanceClaim.Consistency);

        var identityClaim = Assert.Single(context.Claims.Where(claim => claim.Id == "MINT_AUTHORITY_IDENTITY_MATCHES_DOCUMENTED_ISSUANCE_CONTROL"));
        Assert.Equal(ResearchClaimVerificationStatus.NotVerified, identityClaim.VerificationStatus);
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

        var context = ProtocolResearchContextFactory.Create(inspection);

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

        var context = ProtocolResearchContextFactory.Create(inspection);

        Assert.Null(context);
    }

    [Fact]
    public void Create_CanonicalSkrMintWithRevokedMintAuthority_EmitsConflictForIssuanceClaim()
    {
        var inspection = CreateInspection(
            mint: ProtocolConstants.SolanaMobileSkrMint,
            mintAuthority: null,
            mintAuthorityRevoked: true,
            symbol: "SKR",
            name: "Solana Mobile SKR");

        var context = ProtocolResearchContextFactory.Create(inspection);

        Assert.NotNull(context);
        var issuanceClaim = Assert.Single(context.Claims.Where(claim => claim.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE"));
        Assert.Equal(ResearchClaimVerificationStatus.Documented, issuanceClaim.VerificationStatus);
        Assert.Equal(ObservedConsistency.Conflict, issuanceClaim.Consistency);
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
