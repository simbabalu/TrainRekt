using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Tests;

public sealed class CachedTokenInspectionServiceTests
{
    [Fact]
    public async Task InspectAsync_FreshCacheHit_ReturnsSnapshotWithoutDeterministicCall()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var deterministic = new FakeDeterministicInspector(CreateSuccessResult(now));
        var tokenRepository = new FakeTokenRepository();
        var snapshotRepository = new FakeSnapshotRepository();
        snapshotRepository.Snapshots.Add(new CachedTokenInspectionSnapshot(
            Id: "1",
            Mint: Mint,
            InspectedAtUtc: now.AddMinutes(-1),
            CachedAtUtc: now.AddMinutes(-1),
            AnalysisVersion: TokenInspectionAnalysisVersion.Current,
            ExpiresAtUtc: now.AddMinutes(2),
            Result: CreateInspection(now.AddMinutes(-1))));

        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Null(result.Error);
        Assert.Equal(0, deterministic.CallCount);
        Assert.Empty(snapshotRepository.InsertedSnapshots);
    }

    [Fact]
    public async Task InspectAsync_ExpiredCache_CallsDeterministicAndPersistsNewSnapshot()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var deterministic = new FakeDeterministicInspector(CreateSuccessResult(now));
        var tokenRepository = new FakeTokenRepository();
        var snapshotRepository = new FakeSnapshotRepository();
        snapshotRepository.Snapshots.Add(new CachedTokenInspectionSnapshot(
            Id: "old",
            Mint: Mint,
            InspectedAtUtc: now.AddMinutes(-6),
            CachedAtUtc: now.AddMinutes(-6),
            AnalysisVersion: TokenInspectionAnalysisVersion.Current,
            ExpiresAtUtc: now.AddSeconds(-1),
            Result: CreateInspection(now.AddMinutes(-6))));

        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Null(result.Error);
        Assert.Equal(1, deterministic.CallCount);
        Assert.Single(snapshotRepository.InsertedSnapshots);
        Assert.Equal(now.AddMinutes(5), snapshotRepository.InsertedSnapshots[0].ExpiresAtUtc);
    }

    [Fact]
    public async Task InspectAsync_AnalysisVersionMismatch_IgnoresOldSnapshotAndPreservesHistory()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var deterministic = new FakeDeterministicInspector(CreateSuccessResult(now));
        var tokenRepository = new FakeTokenRepository();
        var snapshotRepository = new FakeSnapshotRepository();
        snapshotRepository.Snapshots.Add(new CachedTokenInspectionSnapshot(
            Id: "v0",
            Mint: Mint,
            InspectedAtUtc: now.AddMinutes(-1),
            CachedAtUtc: now.AddMinutes(-1),
            AnalysisVersion: TokenInspectionAnalysisVersion.Current - 1,
            ExpiresAtUtc: now.AddMinutes(3),
            Result: CreateInspection(now.AddMinutes(-1))));

        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Null(result.Error);
        Assert.Equal(1, deterministic.CallCount);
        Assert.Equal(2, snapshotRepository.Snapshots.Count);
        Assert.Contains(snapshotRepository.Snapshots, snapshot => snapshot.AnalysisVersion == TokenInspectionAnalysisVersion.Current - 1);
        Assert.Contains(snapshotRepository.Snapshots, snapshot => snapshot.AnalysisVersion == TokenInspectionAnalysisVersion.Current);
    }

    [Fact]
    public async Task InspectAsync_CacheMiss_PersistsTokenAndSnapshot()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var deterministic = new FakeDeterministicInspector(CreateSuccessResult(now));
        var tokenRepository = new FakeTokenRepository();
        var snapshotRepository = new FakeSnapshotRepository();
        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Null(result.Error);
        Assert.Equal(1, deterministic.CallCount);
        Assert.Single(tokenRepository.Upserts);
        Assert.Single(snapshotRepository.InsertedSnapshots);
    }

    [Fact]
    public async Task InspectAsync_ExistingToken_PreservesFirstSeenAndUpdatesLastSeen()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var firstSeen = now.AddDays(-10);
        var deterministic = new FakeDeterministicInspector(CreateSuccessResult(now));
        var tokenRepository = new FakeTokenRepository();
        tokenRepository.StoredToken = new CachedToken(
            Mint: Mint,
            Name: "old",
            Symbol: "OLD",
            ProgramId: SolanaTokenConstants.SplTokenProgramId,
            FirstSeenAtUtc: firstSeen,
            LastSeenAtUtc: now.AddDays(-1));

        var snapshotRepository = new FakeSnapshotRepository();
        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        var upsert = Assert.Single(tokenRepository.Upserts);
        Assert.Equal(firstSeen, upsert.FirstSeenAtUtc);
        Assert.Equal(now, upsert.LastSeenAtUtc);
    }

    [Fact]
    public async Task InspectAsync_NewToken_SetsFirstSeenAndLastSeen()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var deterministic = new FakeDeterministicInspector(CreateSuccessResult(now));
        var tokenRepository = new FakeTokenRepository();
        var snapshotRepository = new FakeSnapshotRepository();
        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        var upsert = Assert.Single(tokenRepository.Upserts);
        Assert.Equal(now, upsert.FirstSeenAtUtc);
        Assert.Equal(now, upsert.LastSeenAtUtc);
    }

    [Fact]
    public void SnapshotDocument_BsonRoundTrip_PreservesNestedAndPrecisionFields()
    {
        var inspectedAt = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var inspection = CreateInspection(inspectedAt);

        var document = new TokenInspectionSnapshotDocument
        {
            Id = "507f1f77bcf86cd799439011",
            Mint = Mint,
            InspectedAtUtc = inspectedAt.UtcDateTime,
            CachedAtUtc = inspectedAt.UtcDateTime,
            AnalysisVersion = TokenInspectionAnalysisVersion.Current,
            ExpiresAtUtc = inspectedAt.AddMinutes(5).UtcDateTime,
            Result = inspection
        };

        var bson = document.ToBson();
        var roundTrip = BsonSerializer.Deserialize<TokenInspectionSnapshotDocument>(bson);

        Assert.Equal(document.Mint, roundTrip.Mint);
        Assert.Equal("9999999999999999999", roundTrip.Result.Identity.SupplyRaw);
        Assert.Equal("1234567890123456789", roundTrip.Result.LargestTokenAccounts[0].RawAmount);
        Assert.Equal("token-2022", roundTrip.Result.Program.ProgramType);
        Assert.Equal("metadata-pointer", roundTrip.Result.Program.Token2022Extensions[0]);
        Assert.Equal("ACTIVE_MINT_AUTHORITY", roundTrip.Result.ReviewSignals[0].Id);
        Assert.Equal("pump.fun", roundTrip.Result.PumpFunContext?.Protocol);
        Assert.NotNull(roundTrip.Result.ProtocolContext);
        Assert.Equal("DOCUMENTED_INFLATIONARY_ISSUANCE", roundTrip.Result.ProtocolContext.Claims[0].Id);
        Assert.Null(roundTrip.Result.Identity.MetadataUri);
        Assert.Equal("bonding_curve", roundTrip.Result.LargestTokenAccounts[0].Classification.Classification);
    }

    [Fact]
    public async Task InspectAsync_CacheRepositoryFailure_ReturnsPersistenceUnavailable()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var deterministic = new FakeDeterministicInspector(CreateSuccessResult(now));
        var tokenRepository = new FakeTokenRepository();
        var snapshotRepository = new FakeSnapshotRepository { ThrowOnRead = true };
        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Error);
        Assert.Equal(TokenInspectionErrorCode.PersistenceUnavailable, result.Error.Code);
        Assert.DoesNotContain("mongodb://", result.Error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, deterministic.CallCount);
    }

    [Fact]
    public async Task InspectAsync_HeliusFailureAfterCacheMiss_PreservesProviderErrorAndDoesNotPersistSnapshot()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var deterministic = new FakeDeterministicInspector(
            TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderUnavailable, "Helius RPC is temporarily unavailable. Please try again."));
        var tokenRepository = new FakeTokenRepository();
        var snapshotRepository = new FakeSnapshotRepository();
        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Error);
        Assert.Equal(TokenInspectionErrorCode.ProviderUnavailable, result.Error.Code);
        Assert.Empty(snapshotRepository.InsertedSnapshots);
        Assert.Empty(tokenRepository.Upserts);
    }

    [Fact]
    public async Task InspectAsync_SnapshotWriteFailure_ReturnsPersistenceUnavailable()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var deterministic = new FakeDeterministicInspector(CreateSuccessResult(now));
        var tokenRepository = new FakeTokenRepository();
        var snapshotRepository = new FakeSnapshotRepository { ThrowOnWrite = true };
        var service = CreateService(deterministic, tokenRepository, snapshotRepository, now, freshnessMinutes: 5);

        var result = await service.InspectAsync(Mint, CancellationToken.None);

        Assert.NotNull(result.Error);
        Assert.Equal(TokenInspectionErrorCode.PersistenceUnavailable, result.Error.Code);
    }

    private static CachedTokenInspectionService CreateService(
        FakeDeterministicInspector deterministic,
        FakeTokenRepository tokenRepository,
        FakeSnapshotRepository snapshotRepository,
        DateTimeOffset now,
        int freshnessMinutes)
    {
        return new CachedTokenInspectionService(
            deterministic,
            tokenRepository,
            snapshotRepository,
            Options.Create(new TokenInspectionCacheOptions { FreshnessMinutes = freshnessMinutes }),
            new FixedTimeProvider(now),
            NullLogger<CachedTokenInspectionService>.Instance);
    }

    private static TokenInspectionResult CreateSuccessResult(DateTimeOffset inspectedAt)
    {
        return TokenInspectionResult.Success(CreateInspection(inspectedAt));
    }

    private static TokenInspection CreateInspection(DateTimeOffset inspectedAt)
    {
        return new TokenInspection(
            Identity: new TokenIdentity(
                Mint: Mint,
                Name: "Pump Token",
                Symbol: "PUMP",
                Decimals: 6,
                SupplyRaw: "9999999999999999999",
                ProgramId: SolanaTokenConstants.Token2022ProgramId,
                MetadataUri: null),
            Authorities: new TokenAuthorities(
                MintAuthority: "auth",
                MintAuthorityRevoked: false,
                FreezeAuthority: null,
                FreezeAuthorityRevoked: true),
            Program: new TokenProgramInfo(
                ProgramType: "token-2022",
                ProgramId: SolanaTokenConstants.Token2022ProgramId,
                Token2022Extensions: new[] { "metadata-pointer" }),
            Age: new TokenAgeInfo(
                AgeSeconds: null,
                InferredCreatedAtUtc: null,
                IsReliable: false,
                UnavailableReason: "n/a"),
            HolderConcentration: new HolderConcentration(
                TopHolderPercentage: 60.1234m,
                Top5HoldersPercentage: 80.1234m,
                Top10HoldersPercentage: 90.1234m,
                SemanticsNote: "token-account concentration",
                UnclassifiedTokenAccountConcentration: new UnclassifiedTokenAccountConcentration(
                    ClassifiedProtocolPercentage: 60.1234m,
                    UnknownPercentageWithinReportedLargestAccounts: 39.8766m,
                    LargestUnknownTokenAccountPercentage: 20.1234m,
                    Top5UnknownTokenAccountsPercentage: 39.8766m,
                    SemanticsNote: "unknown concentration")),
            LargestTokenAccounts: new[]
            {
                new AnalyzedTokenAccount(
                    Address: "tok1",
                    Authority: "curve",
                    Mint: Mint,
                    TokenProgram: SolanaTokenConstants.Token2022ProgramId,
                    RawAmount: "1234567890123456789",
                    Percentage: 60.1234m,
                    Classification: new TokenAccountClassification(
                        Classification: TokenAccountClassificationConstants.BondingCurve,
                        Protocol: ProtocolConstants.PumpFunProtocolName,
                        Confidence: TokenAccountClassificationConstants.Verified,
                        Evidence: new[]
                        {
                            new TokenAccountClassificationEvidence("derived_bonding_curve_pda", "curve")
                        }))
            },
            PumpFunContext: new PumpFunContext(
                Protocol: ProtocolConstants.PumpFunProtocolName,
                BondingCurveDetected: true,
                BondingCurveAddress: "curve",
                BondingCurveTokenAccount: "tok1",
                Complete: false),
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
                        Statement: "Ongoing issuance is documented.",
                        VerificationStatus: ResearchClaimVerificationStatus.Documented,
                        VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                        SourceIds: new[] { ProtocolConstants.SolanaMobileSkrTokenomicsSourceId },
                        ObservedFactReferences: new[]
                        {
                            new ObservedFactReference(
                                FactId: ObservedFactIds.MintAuthorityActive,
                                ObservedValue: "true",
                                ExpectedValue: null,
                                Note: null)
                        },
                        VerificationNote: null)
                }),
            ReviewSignals: new[]
            {
                new TokenReviewSignal(
                    Id: "ACTIVE_MINT_AUTHORITY",
                    Category: "review",
                    Severity: "medium",
                    Explanation: "active",
                    Evidence: new Dictionary<string, string> { ["mintAuthority"] = "auth" })
            },
            InspectedAtUtc: inspectedAt);
    }

    private sealed class FakeDeterministicInspector : ITokenInspectionDeterministicService
    {
        private readonly TokenInspectionResult _result;

        public int CallCount { get; private set; }

        public FakeDeterministicInspector(TokenInspectionResult result)
        {
            _result = result;
        }

        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            CallCount += 1;
            return Task.FromResult(_result);
        }
    }

    private sealed class FakeTokenRepository : ITokenRepository
    {
        public CachedToken? StoredToken { get; set; }

        public List<CachedToken> Upserts { get; } = new();

        public Task<CachedToken?> GetByMintAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult(StoredToken?.Mint == mint ? StoredToken : null);
        }

        public Task UpsertAsync(CachedToken token, CancellationToken cancellationToken)
        {
            Upserts.Add(token);
            StoredToken = token;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeSnapshotRepository : ITokenInspectionSnapshotRepository
    {
        public bool ThrowOnRead { get; set; }

        public bool ThrowOnWrite { get; set; }

        public List<CachedTokenInspectionSnapshot> Snapshots { get; } = new();

        public List<CachedTokenInspectionSnapshot> InsertedSnapshots { get; } = new();

        public Task<CachedTokenInspectionSnapshot?> GetLatestFreshAsync(
            string mint,
            int analysisVersion,
            DateTimeOffset nowUtc,
            CancellationToken cancellationToken)
        {
            if (ThrowOnRead)
            {
                throw new InvalidOperationException("mongo unavailable");
            }

            var snapshot = Snapshots
                .Where(entry => entry.Mint == mint
                    && entry.AnalysisVersion == analysisVersion
                    && entry.ExpiresAtUtc > nowUtc)
                .OrderByDescending(entry => entry.InspectedAtUtc)
                .FirstOrDefault();

            return Task.FromResult(snapshot);
        }

        public Task<CachedTokenInspectionSnapshot?> GetLatestByMintAsync(string mint, CancellationToken cancellationToken)
        {
            if (ThrowOnRead)
            {
                throw new InvalidOperationException("mongo unavailable");
            }

            var snapshot = Snapshots
                .Where(entry => entry.Mint == mint)
                .OrderByDescending(entry => entry.InspectedAtUtc)
                .FirstOrDefault();

            return Task.FromResult(snapshot);
        }

        public Task InsertAsync(CachedTokenInspectionSnapshot snapshot, CancellationToken cancellationToken)
        {
            if (ThrowOnWrite)
            {
                throw new InvalidOperationException("mongo unavailable");
            }

            var persisted = snapshot with
            {
                Id = Guid.NewGuid().ToString("N")
            };

            InsertedSnapshots.Add(persisted);
            Snapshots.Add(persisted);
            return Task.CompletedTask;
        }
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _utcNow;

        public FixedTimeProvider(DateTimeOffset utcNow)
        {
            _utcNow = utcNow;
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;
    }

    private const string Mint = "So11111111111111111111111111111111111111112";
}
