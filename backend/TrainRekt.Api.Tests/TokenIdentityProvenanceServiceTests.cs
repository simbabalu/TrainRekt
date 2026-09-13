using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenIdentityProvenanceServiceTests
{
    [Fact]
    public async Task AnalyzeAsync_InspectionFailure_ReturnsInspectionErrorAndSkipsRepository()
    {
        var inspectionService = new StubInspectionService(TokenInspectionResult.Failure(TokenInspectionErrorCode.InvalidMint, "bad"));
        var repository = new StubObservationRepository();
        var service = CreateService(inspectionService, repository);

        var result = await service.AnalyzeAsync("bad", CancellationToken.None);

        Assert.NotNull(result.InspectionError);
        Assert.Null(result.Provenance);
        Assert.Equal(0, repository.UpsertCount);
        Assert.Equal(0, repository.FindCount);
    }

    [Fact]
    public async Task AnalyzeAsync_WithNoCollisions_ReturnsNoMeaningfulCollisionFound()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(0, Array.Empty<TokenIdentityObservation>())
        };

        var service = CreateService(inspectionService, repository);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.NoMeaningfulCollisionFound, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.High, result.Provenance.Confidence);
        Assert.False(result.Provenance.IsTruncated);
    }

    [Fact]
    public async Task AnalyzeAsync_WithExactCollision_ReturnsCollisionObserved()
    {
        var now = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                1,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint222",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: now.AddMinutes(-30),
                        LastObservedAtUtc: now.AddMinutes(-10),
                        ObservationVersion: 1)
                })
        };

        var service = CreateService(inspectionService, repository, time: now);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.CollisionObserved, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.High, result.Provenance.Confidence);
        Assert.Single(result.Provenance.Collisions);
        Assert.Equal(TokenIdentityMatchLevel.Exact, result.Provenance.Collisions[0].MatchLevel);
        Assert.NotNull(result.Provenance.EarliestObservedMatch);
    }

    [Fact]
    public async Task AnalyzeAsync_WithNormalizedOnlyCollision_ReturnsAmbiguousLowConfidence()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                1,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint333",
                        RawName: "research-token",
                        NormalizedName: "research token",
                        RawSymbol: "r ch",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-15),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-1),
                        ObservationVersion: 1)
                })
        };

        var service = CreateService(inspectionService, repository);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.Ambiguous, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.Low, result.Provenance.Confidence);
        Assert.Equal(TokenIdentityMatchLevel.NormalizedExact, result.Provenance.Collisions[0].MatchLevel);
    }

    [Fact]
    public async Task AnalyzeAsync_WithMissingNameAndSymbol_ReturnsInsufficientEvidenceAndUnknown()
    {
        var inspection = CreateInspection("Mint111", null, null);
        var inspectionService = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository();
        var service = CreateService(inspectionService, repository);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.InsufficientEvidence, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.None, result.Provenance.Confidence);
        Assert.Contains(TokenIdentityProvenanceUnknown.ScannedIdentityFieldsMissing, result.Provenance.Unknowns);
    }

    [Fact]
    public async Task AnalyzeAsync_WithTruncatedResults_LowersCollisionConfidence()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository
        {
            QueryResult = new TokenIdentityObservationQueryResult(
                3,
                new[]
                {
                    new TokenIdentityObservation(
                        Mint: "Mint222",
                        RawName: "Research Token",
                        NormalizedName: "research token",
                        RawSymbol: "RCH",
                        NormalizedSymbol: "rch",
                        TokenProgram: inspection.Program.ProgramId,
                        FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-20),
                        LastObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-10),
                        ObservationVersion: 1)
                })
        };

        var service = CreateService(inspectionService, repository, options: new TokenIdentityProvenanceOptions { MaxReturnedCollisions = 1 });

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.Provenance);
        Assert.Equal(TokenIdentityProvenanceResultType.CollisionObserved, result.Provenance!.Result);
        Assert.Equal(TokenIdentityProvenanceConfidence.Medium, result.Provenance.Confidence);
        Assert.True(result.Provenance.IsTruncated);
        Assert.Equal(3, result.Provenance.TotalCollisionCount);
        Assert.Equal(1, result.Provenance.ReturnedCollisionCount);
    }

    [Fact]
    public async Task AnalyzeAsync_RepositoryFailure_ReturnsPersistenceUnavailable()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository { ThrowOnUpsert = true };
        var service = CreateService(inspectionService, repository);

        var result = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.NotNull(result.InspectionError);
        Assert.Equal(TokenInspectionErrorCode.PersistenceUnavailable, result.InspectionError!.Code);
        Assert.Null(result.Provenance);
    }

    [Fact]
    public async Task AnalyzeAsync_RepositoryCancellation_Propagates()
    {
        var inspection = CreateInspection("Mint111", "Research Token", "RCH");
        var inspectionService = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository { ThrowCancellation = true };
        var service = CreateService(inspectionService, repository);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None));
    }

    [Fact]
    public async Task AnalyzeAsync_DoesNotMutateInspectionOrProtocolContext()
    {
        var protocolContext = new ProtocolResearchContext("protocol", Array.Empty<ResearchSource>(), Array.Empty<DocumentedClaim>());
        var inspection = CreateInspection("Mint111", "Research Token", "RCH", protocolContext);
        var inspectionService = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var repository = new StubObservationRepository();
        var service = CreateService(inspectionService, repository);

        _ = await service.AnalyzeAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Same(protocolContext, inspection.ProtocolContext);
        Assert.Equal("Research Token", inspection.Identity.Name);
        Assert.Equal("RCH", inspection.Identity.Symbol);
    }

    private static TokenInspection CreateInspection(string mint, string? name, string? symbol, ProtocolResearchContext? protocolContext = null)
    {
        var baseInspection = ResearchTestData.CreateInspection(protocolContext: protocolContext);
        return baseInspection with
        {
            Identity = baseInspection.Identity with
            {
                Mint = mint,
                Name = name,
                Symbol = symbol
            }
        };
    }

    private static TokenIdentityProvenanceService CreateService(
        ITokenInspectionService inspectionService,
        ITokenIdentityObservationRepository observationRepository,
        TokenIdentityProvenanceOptions? options = null,
        DateTimeOffset? time = null)
    {
        options ??= new TokenIdentityProvenanceOptions { MaxReturnedCollisions = 25 };
        var now = time ?? new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);

        return new TokenIdentityProvenanceService(
            inspectionService,
            observationRepository,
            new TokenIdentityNormalizer(),
            Options.Create(options),
            new FixedTimeProvider(now),
            NullLogger<TokenIdentityProvenanceService>.Instance);
    }

    private sealed class StubInspectionService : ITokenInspectionService
    {
        private readonly TokenInspectionResult _result;

        public StubInspectionService(TokenInspectionResult result)
        {
            _result = result;
        }

        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult(_result);
        }
    }

    private sealed class StubObservationRepository : ITokenIdentityObservationRepository
    {
        public bool ThrowOnUpsert { get; set; }

        public bool ThrowCancellation { get; set; }

        public int UpsertCount { get; private set; }

        public int FindCount { get; private set; }

        public TokenIdentityObservationQueryResult QueryResult { get; set; } =
            new(0, Array.Empty<TokenIdentityObservation>());

        public Task<TokenIdentityObservation?> GetByMintAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult<TokenIdentityObservation?>(null);
        }

        public Task UpsertAsync(TokenIdentityObservation observation, CancellationToken cancellationToken)
        {
            if (ThrowCancellation)
            {
                throw new OperationCanceledException("cancelled");
            }

            if (ThrowOnUpsert)
            {
                throw new InvalidOperationException("upsert failed");
            }

            UpsertCount += 1;
            return Task.CompletedTask;
        }

        public Task<TokenIdentityObservationQueryResult> FindCollisionsAsync(
            string excludingMint,
            string? normalizedName,
            string? normalizedSymbol,
            int limit,
            CancellationToken cancellationToken)
        {
            if (ThrowCancellation)
            {
                throw new OperationCanceledException("cancelled");
            }

            FindCount += 1;
            return Task.FromResult(QueryResult);
        }
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _now;

        public FixedTimeProvider(DateTimeOffset now)
        {
            _now = now;
        }

        public override DateTimeOffset GetUtcNow() => _now;
    }
}
