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
            ProtocolContext: new ProtocolResearchContext(
                Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
                Sources: new[]
                {
                    new ResearchSource(
                        Id: ProtocolConstants.SolanaMobileSkrTokenomicsSourceId,
                        SourceType: ResearchSourceType.OfficialDocumentation,
                        Title: "SKR docs",
                        Publisher: "Solana Mobile",
                        Url: "https://docs.solanamobile.com/solana-mobile-stack/skr",
                        RetrievedAtUtc: null,
                        PublishedAtUtc: null)
                },
                Claims: new[]
                {
                    new DocumentedClaim(
                        Id: "DOCUMENTED_INFLATIONARY_ISSUANCE",
                        Category: "issuance",
                        Statement: "Ongoing issuance for staking rewards is documented.",
                        VerificationStatus: ResearchClaimVerificationStatus.Documented,
                        VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                        SourceIds: new[] { ProtocolConstants.SolanaMobileSkrTokenomicsSourceId },
                        ObservedFactReferences: new[]
                        {
                            new ObservedFactReference(
                                FactId: ObservedFactIds.MintAuthorityActive,
                                ObservedValue: "true",
                                ExpectedValue: "true",
                                Note: null)
                        },
                        VerificationNote: null,
                        Consistency: ObservedConsistency.Consistent)
                }),
            ReviewSignals: Array.Empty<TokenReviewSignal>(),
            InspectedAtUtc: DateTimeOffset.UtcNow);

        var signals = TokenReviewSignalFactory.Create(inspection);

        var activeMintAuthority = Assert.Single(signals.Where(signal => signal.Id == "ACTIVE_MINT_AUTHORITY"));
        Assert.Equal("informational", activeMintAuthority.Category);

        var documentedIssuance = Assert.Single(signals.Where(signal => signal.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE"));
        Assert.Equal("Documented", documentedIssuance.Evidence["verificationStatus"]);
        Assert.Equal("Consistent", documentedIssuance.Evidence["consistency"]);
        Assert.Contains("not been independently verified", documentedIssuance.Explanation, StringComparison.Ordinal);
    }

    [Fact]
    public void Create_DocumentedClaimContextAppliesWithoutAnySkrMintChecks()
    {
        var inspection = new TokenInspection(
            Identity: new TokenIdentity(
                Mint: "SomeOtherMint",
                Name: "Other",
                Symbol: "OTH",
                Decimals: 6,
                SupplyRaw: "1000000",
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
            ProtocolContext: new ProtocolResearchContext(
                Protocol: "other-protocol",
                Sources: new[]
                {
                    new ResearchSource(
                        Id: "src",
                        SourceType: ResearchSourceType.OfficialDocumentation,
                        Title: "Docs",
                        Publisher: "Org",
                        Url: "https://example.com",
                        RetrievedAtUtc: null,
                        PublishedAtUtc: null)
                },
                Claims: new[]
                {
                    new DocumentedClaim(
                        Id: "DOCUMENTED_INFLATIONARY_ISSUANCE",
                        Category: "issuance",
                        Statement: "Inflationary issuance is documented.",
                        VerificationStatus: ResearchClaimVerificationStatus.Documented,
                        VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                        SourceIds: new[] { "src" },
                        ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                        VerificationNote: null)
                }),
            ReviewSignals: Array.Empty<TokenReviewSignal>(),
            InspectedAtUtc: DateTimeOffset.UtcNow);

        var signals = TokenReviewSignalFactory.Create(inspection);

        Assert.Contains(signals, signal => signal.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE");
        Assert.Equal("informational", signals.Single(signal => signal.Id == "ACTIVE_MINT_AUTHORITY").Category);
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
            ProtocolContext: new ProtocolResearchContext(
                Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
                Sources: new[]
                {
                    new ResearchSource(
                        Id: ProtocolConstants.SolanaMobileSkrTokenomicsSourceId,
                        SourceType: ResearchSourceType.OfficialDocumentation,
                        Title: "SKR docs",
                        Publisher: "Solana Mobile",
                        Url: "https://docs.solanamobile.com/solana-mobile-stack/skr",
                        RetrievedAtUtc: null,
                        PublishedAtUtc: null)
                },
                Claims: new[]
                {
                    new DocumentedClaim(
                        Id: "DOCUMENTED_INFLATIONARY_ISSUANCE",
                        Category: "issuance",
                        Statement: "Ongoing issuance for staking rewards is documented.",
                        VerificationStatus: ResearchClaimVerificationStatus.Documented,
                        VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                        SourceIds: new[] { ProtocolConstants.SolanaMobileSkrTokenomicsSourceId },
                        ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                        VerificationNote: null,
                        Consistency: ObservedConsistency.Conflict)
                }),
            ReviewSignals: Array.Empty<TokenReviewSignal>(),
            InspectedAtUtc: DateTimeOffset.UtcNow);

        var signals = TokenReviewSignalFactory.Create(inspection);

        Assert.DoesNotContain(signals, signal => signal.Id == "ACTIVE_MINT_AUTHORITY");
        Assert.Contains(signals, signal => signal.Id == "MINT_AUTHORITY_STATE_MISMATCH_WITH_DOCUMENTED_ISSUANCE");
    }
}
