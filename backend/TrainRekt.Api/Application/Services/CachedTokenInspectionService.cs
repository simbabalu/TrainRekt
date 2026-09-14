using System.Diagnostics;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Application.Services;

public sealed class CachedTokenInspectionService : ITokenInspectionService, ITokenInspectionCoreService
{
    private readonly ITokenInspectionDeterministicService _deterministicService;
    private readonly ITokenRepository _tokenRepository;
    private readonly ITokenInspectionSnapshotRepository _snapshotRepository;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<CachedTokenInspectionService> _logger;
    private readonly int _freshnessMinutes;

    public CachedTokenInspectionService(
        ITokenInspectionDeterministicService deterministicService,
        ITokenRepository tokenRepository,
        ITokenInspectionSnapshotRepository snapshotRepository,
        IOptions<TokenInspectionCacheOptions> cacheOptions,
        TimeProvider timeProvider,
        ILogger<CachedTokenInspectionService> logger)
    {
        _deterministicService = deterministicService;
        _tokenRepository = tokenRepository;
        _snapshotRepository = snapshotRepository;
        _timeProvider = timeProvider;
        _logger = logger;
        _freshnessMinutes = cacheOptions.Value.FreshnessMinutes;
    }

    public async Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
    {
        var totalStopwatch = Stopwatch.StartNew();
        var cacheStopwatch = Stopwatch.StartNew();

        if (!SolanaPublicKeyValidator.TryNormalize(mint, out var normalizedMint))
        {
            return TokenInspectionResult.Failure(
                TokenInspectionErrorCode.InvalidMint,
                "The provided mint is not a syntactically valid Solana public key.");
        }

        var nowUtc = _timeProvider.GetUtcNow();

        try
        {
            var cachedSnapshot = await _snapshotRepository.GetLatestFreshAsync(
                normalizedMint,
                TokenInspectionAnalysisVersion.Current,
                nowUtc,
                cancellationToken);

            if (cachedSnapshot is not null)
            {
                var cacheMs = ElapsedMilliseconds(cacheStopwatch);
                var totalMs = ElapsedMilliseconds(totalStopwatch);
                _logger.LogInformation(
                    "Token inspection cache hit for mint {Mint} at analysisVersion {AnalysisVersion}. cacheMs={CacheMs} totalMs={TotalMs}.",
                    normalizedMint,
                    TokenInspectionAnalysisVersion.Current,
                    cacheMs,
                    totalMs);

                return TokenInspectionResult.Success(cachedSnapshot.Result);
            }

            _logger.LogInformation("Token inspection cache miss for mint {Mint}.", normalizedMint);
        }
        catch (OperationCanceledException)
        {
            return TokenInspectionResult.Failure(
                TokenInspectionErrorCode.Cancelled,
                "The token inspection request was cancelled.");
        }
        catch (Exception)
        {
            return TokenInspectionResult.Failure(
                TokenInspectionErrorCode.PersistenceUnavailable,
                "Token inspection persistence is temporarily unavailable. Please try again.");
        }

        var cacheLookupMs = ElapsedMilliseconds(cacheStopwatch);
        var deterministicStopwatch = Stopwatch.StartNew();
        var freshInspectionResult = await _deterministicService.InspectAsync(normalizedMint, cancellationToken);
        var deterministicInspectionMs = ElapsedMilliseconds(deterministicStopwatch);
        if (freshInspectionResult.Error is not null || freshInspectionResult.Inspection is null)
        {
            return freshInspectionResult;
        }

        var inspection = freshInspectionResult.Inspection;
        var expiresAtUtc = nowUtc.AddMinutes(_freshnessMinutes);

        var persistStopwatch = Stopwatch.StartNew();
        try
        {
            var existingToken = await _tokenRepository.GetByMintAsync(normalizedMint, cancellationToken);
            var firstSeenAtUtc = existingToken?.FirstSeenAtUtc ?? nowUtc;

            var token = new CachedToken(
                Mint: normalizedMint,
                Name: inspection.Identity.Name,
                Symbol: inspection.Identity.Symbol,
                ProgramId: inspection.Identity.ProgramId,
                FirstSeenAtUtc: firstSeenAtUtc,
                LastSeenAtUtc: nowUtc);

            await _tokenRepository.UpsertAsync(token, cancellationToken);

            var snapshot = new CachedTokenInspectionSnapshot(
                Id: string.Empty,
                Mint: normalizedMint,
                InspectedAtUtc: inspection.InspectedAtUtc,
                CachedAtUtc: nowUtc,
                AnalysisVersion: TokenInspectionAnalysisVersion.Current,
                ExpiresAtUtc: expiresAtUtc,
                Result: inspection);

            await _snapshotRepository.InsertAsync(snapshot, cancellationToken);

            _logger.LogInformation(
                "Token inspection snapshot persisted for mint {Mint} at analysisVersion {AnalysisVersion}. cacheMs={CacheMs} deterministicInspectionMs={DeterministicInspectionMs} persistenceMs={PersistenceMs} totalMs={TotalMs}.",
                normalizedMint,
                TokenInspectionAnalysisVersion.Current,
                cacheLookupMs,
                deterministicInspectionMs,
                ElapsedMilliseconds(persistStopwatch),
                ElapsedMilliseconds(totalStopwatch));

            return TokenInspectionResult.Success(inspection);
        }
        catch (OperationCanceledException)
        {
            return TokenInspectionResult.Failure(
                TokenInspectionErrorCode.Cancelled,
                "The token inspection request was cancelled.");
        }
        catch (Exception)
        {
            return TokenInspectionResult.Failure(
                TokenInspectionErrorCode.PersistenceUnavailable,
                "Token inspection persistence is temporarily unavailable. Please try again.");
        }
    }

    private static long ElapsedMilliseconds(Stopwatch stopwatch)
    {
        return (long)Math.Round(stopwatch.Elapsed.TotalMilliseconds, MidpointRounding.AwayFromZero);
    }
}
