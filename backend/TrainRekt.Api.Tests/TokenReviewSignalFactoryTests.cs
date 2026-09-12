using System.Globalization;
using TrainRekt.Api.Domain.Analysis;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenReviewSignalFactoryTests
{
    [Fact]
    public void Create_EmitsNeutralDeterministicSignals()
    {
        var inspection = new TokenInspection(
            Identity: new TokenIdentity(
                Mint: "mint",
                Name: "Token",
                Symbol: "TKN",
                Decimals: 6,
                SupplyRaw: "1000000",
                ProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                MetadataUri: null),
            Authorities: new TokenAuthorities(
                MintAuthority: "mint-auth",
                MintAuthorityRevoked: false,
                FreezeAuthority: "freeze-auth",
                FreezeAuthorityRevoked: false),
            Program: new TokenProgramInfo(
                ProgramType: "token-2022",
                ProgramId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                Token2022Extensions: new[] { "metadata-pointer" }),
            Age: new TokenAgeInfo(
                AgeSeconds: null,
                InferredCreatedAtUtc: null,
                IsReliable: false,
                UnavailableReason: "n/a"),
            HolderConcentration: new HolderConcentration(
                TopHolderPercentage: 60m,
                Top5HoldersPercentage: 80m,
                Top10HoldersPercentage: 90m,
                SemanticsNote: "token-account concentration",
                UnclassifiedTokenAccountConcentration: null),
            LargestTokenAccounts: Array.Empty<AnalyzedTokenAccount>(),
            PumpFunContext: null,
            ProtocolContext: null,
            ReviewSignals: Array.Empty<TokenReviewSignal>(),
            InspectedAtUtc: DateTimeOffset.UtcNow);

        var signals = TokenReviewSignalFactory.Create(inspection);

        Assert.Contains(signals, signal => signal.Id == "ACTIVE_MINT_AUTHORITY");
        Assert.Contains(signals, signal => signal.Id == "ACTIVE_FREEZE_AUTHORITY");
        Assert.Contains(signals, signal => signal.Id == "TOKEN_2022");
        Assert.Contains(signals, signal => signal.Id == "LARGE_TOKEN_ACCOUNT_BALANCE");
        Assert.DoesNotContain(signals, signal => signal.Id == "HIGH_TOP_HOLDER_CONCENTRATION");
        Assert.DoesNotContain(signals, signal => signal.Id is "BUY" or "SELL" or "SAFE" or "SCAM");
    }

    [Fact]
    public void Create_UsesInvariantCultureForDecimalEvidence()
    {
        var originalCulture = CultureInfo.CurrentCulture;
        var originalUiCulture = CultureInfo.CurrentUICulture;

        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("de-DE");
            CultureInfo.CurrentUICulture = new CultureInfo("de-DE");

            var inspection = new TokenInspection(
                Identity: new TokenIdentity(
                    Mint: "mint",
                    Name: "Token",
                    Symbol: "TKN",
                    Decimals: 6,
                    SupplyRaw: "1000000",
                    ProgramId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                    MetadataUri: null),
                Authorities: new TokenAuthorities(
                    MintAuthority: null,
                    MintAuthorityRevoked: true,
                    FreezeAuthority: null,
                    FreezeAuthorityRevoked: true),
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
                    TopHolderPercentage: 95.1442m,
                    Top5HoldersPercentage: 96m,
                    Top10HoldersPercentage: 97m,
                    SemanticsNote: "largest token account concentration",
                    UnclassifiedTokenAccountConcentration: null),
                LargestTokenAccounts: Array.Empty<AnalyzedTokenAccount>(),
                PumpFunContext: null,
                ProtocolContext: null,
                ReviewSignals: Array.Empty<TokenReviewSignal>(),
                InspectedAtUtc: DateTimeOffset.UtcNow);

            var signals = TokenReviewSignalFactory.Create(inspection);
            var signal = Assert.Single(signals.Where(signal => signal.Id == "LARGE_TOKEN_ACCOUNT_BALANCE"));

            Assert.Equal("95.1442", signal.Evidence["largestTokenAccountPercentage"]);
            Assert.Equal("50", signal.Evidence["thresholdPercent"]);
        }
        finally
        {
            CultureInfo.CurrentCulture = originalCulture;
            CultureInfo.CurrentUICulture = originalUiCulture;
        }
    }

    [Fact]
    public void Create_SkrContextAddsDocumentedIssuanceSignalAndKeepsMintAuthorityFact()
    {
        var inspection = new TokenInspection(
            Identity: new TokenIdentity(
                Mint: ProtocolConstants.SolanaMobileSkrMint,
                Name: "SKR",
                Symbol: "SKR",
                Decimals: 6,
                SupplyRaw: "10000000000",
                ProgramId: SolanaTokenConstants.SplTokenProgramId,
                MetadataUri: null),
            Authorities: new TokenAuthorities(
                MintAuthority: "auth",
                MintAuthorityRevoked: false,
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
            ProtocolContext: new TokenProtocolContext(
                Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
                Issuance: new TokenIssuanceProtocolContext(
                    Classification: "documented_inflationary_issuance",
                    Verification: "official_documentation",
                    SourceIds: new[]
                    {
                        ProtocolConstants.SolanaMobileSkrTokenomicsSourceId,
                        ProtocolConstants.SolanaMobileSkrStakingIdlSourceId
                    },
                    MintAuthorityStateConsistentWithDocumentedModel: true,
                    MintAuthorityIdentityVerified: false,
                    MintAuthorityIdentityVerificationNote: "not tied to a specific key")),
            ReviewSignals: Array.Empty<TokenReviewSignal>(),
            InspectedAtUtc: DateTimeOffset.UtcNow);

        var signals = TokenReviewSignalFactory.Create(inspection);

        var activeMintAuthority = Assert.Single(signals.Where(signal => signal.Id == "ACTIVE_MINT_AUTHORITY"));
        Assert.Equal("informational", activeMintAuthority.Category);

        var documentedIssuance = Assert.Single(signals.Where(signal => signal.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE"));
        Assert.Equal("official_documentation", documentedIssuance.Evidence["sourceType"]);
        Assert.Equal("false", documentedIssuance.Evidence["mintAuthorityIdentityVerified"]);
    }

    [Fact]
    public void Create_SkrContextWithRevokedMintAuthority_EmitsMismatchSignal()
    {
        var inspection = new TokenInspection(
            Identity: new TokenIdentity(
                Mint: ProtocolConstants.SolanaMobileSkrMint,
                Name: "SKR",
                Symbol: "SKR",
                Decimals: 6,
                SupplyRaw: "10000000000",
                ProgramId: SolanaTokenConstants.SplTokenProgramId,
                MetadataUri: null),
            Authorities: new TokenAuthorities(
                MintAuthority: null,
                MintAuthorityRevoked: true,
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
            ProtocolContext: new TokenProtocolContext(
                Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
                Issuance: new TokenIssuanceProtocolContext(
                    Classification: "documented_inflationary_issuance",
                    Verification: "official_documentation",
                    SourceIds: new[] { ProtocolConstants.SolanaMobileSkrTokenomicsSourceId },
                    MintAuthorityStateConsistentWithDocumentedModel: false,
                    MintAuthorityIdentityVerified: false,
                    MintAuthorityIdentityVerificationNote: null)),
            ReviewSignals: Array.Empty<TokenReviewSignal>(),
            InspectedAtUtc: DateTimeOffset.UtcNow);

        var signals = TokenReviewSignalFactory.Create(inspection);

        Assert.DoesNotContain(signals, signal => signal.Id == "ACTIVE_MINT_AUTHORITY");
        Assert.Contains(signals, signal => signal.Id == "MINT_AUTHORITY_STATE_MISMATCH_WITH_DOCUMENTED_ISSUANCE");
    }
}
