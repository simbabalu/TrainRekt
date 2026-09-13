using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenIdentityProvenanceService : ITokenIdentityProvenanceService
{
    private const int ObservationVersion = 1;
    private const string EarliestObservedSemantics = "Among identities observed by TrainRekt, this mint was observed first for the matching normalized identity.";

    private readonly ITokenInspectionService _inspectionService;
    private readonly ITokenIdentityObservationRepository _observationRepository;
    private readonly TokenIdentityNormalizer _normalizer;
    private readonly TokenIdentityProvenanceOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<TokenIdentityProvenanceService> _logger;

    public TokenIdentityProvenanceService(
        ITokenInspectionService inspectionService,
        ITokenIdentityObservationRepository observationRepository,
        TokenIdentityNormalizer normalizer,
        IOptions<TokenIdentityProvenanceOptions> options,
        TimeProvider timeProvider,
        ILogger<TokenIdentityProvenanceService> logger)
    {
        _inspectionService = inspectionService;
        _observationRepository = observationRepository;
        _normalizer = normalizer;
        _options = options.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<TokenIdentityProvenanceResult> AnalyzeAsync(string mint, CancellationToken cancellationToken)
    {
        var inspectionResult = await _inspectionService.InspectAsync(mint, cancellationToken);
        if (inspectionResult.Error is not null)
        {
            return new TokenIdentityProvenanceResult(inspectionResult.Error, null);
        }

        if (inspectionResult.Inspection is null)
        {
            return new TokenIdentityProvenanceResult(
                new TokenInspectionError(TokenInspectionErrorCode.ProviderMalformedResponse, "Token inspection produced no result."),
                null);
        }

        var inspection = inspectionResult.Inspection;
        var nowUtc = _timeProvider.GetUtcNow();
        var normalizedName = _normalizer.NormalizeName(inspection.Identity.Name);
        var normalizedSymbol = _normalizer.NormalizeSymbol(inspection.Identity.Symbol);

        var observation = new TokenIdentityObservation(
            Mint: inspection.Identity.Mint,
            RawName: inspection.Identity.Name,
            NormalizedName: normalizedName,
            RawSymbol: inspection.Identity.Symbol,
            NormalizedSymbol: normalizedSymbol,
            TokenProgram: inspection.Program.ProgramId,
            FirstObservedAtUtc: nowUtc,
            LastObservedAtUtc: nowUtc,
            ObservationVersion: ObservationVersion);

        TokenIdentityObservationQueryResult queryResult;
        try
        {
            await _observationRepository.UpsertAsync(observation, cancellationToken);
            queryResult = await _observationRepository.FindCollisionsAsync(
                inspection.Identity.Mint,
                normalizedName,
                normalizedSymbol,
                _options.MaxReturnedCollisions,
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Token identity provenance repository operation failed for mint {Mint}.", inspection.Identity.Mint);
            return new TokenIdentityProvenanceResult(
                new TokenInspectionError(TokenInspectionErrorCode.PersistenceUnavailable, "Identity provenance data is temporarily unavailable."),
                null);
        }

        var collisions = new List<TokenIdentityCollision>(queryResult.Observations.Count);
        foreach (var candidate in queryResult.Observations)
        {
            var (dimensions, level) = DetermineMatch(
                observation.RawName,
                observation.NormalizedName,
                observation.RawSymbol,
                observation.NormalizedSymbol,
                candidate.RawName,
                candidate.NormalizedName,
                candidate.RawSymbol,
                candidate.NormalizedSymbol);

            if (dimensions.Count == 0)
            {
                continue;
            }

            collisions.Add(new TokenIdentityCollision(
                CandidateMint: candidate.Mint,
                RawName: candidate.RawName,
                RawSymbol: candidate.RawSymbol,
                MatchDimensions: dimensions,
                MatchLevel: level,
                FirstObservedAtUtc: candidate.FirstObservedAtUtc,
                LastObservedAtUtc: candidate.LastObservedAtUtc));
        }

        collisions.Sort(static (left, right) =>
        {
            var time = left.FirstObservedAtUtc.CompareTo(right.FirstObservedAtUtc);
            return time != 0 ? time : string.Compare(left.CandidateMint, right.CandidateMint, StringComparison.Ordinal);
        });

        var totalCount = queryResult.TotalCount;
        var returnedCount = collisions.Count;
        var isTruncated = totalCount > returnedCount;
        var earliest = collisions.FirstOrDefault();

        var conflictingEvidence = BuildConflictingEvidence(collisions);
        var evidence = BuildEvidence(observation, collisions, earliest, isTruncated);

        var unknowns = new List<TokenIdentityProvenanceUnknown>
        {
            TokenIdentityProvenanceUnknown.GlobalHistoryNotChecked,
            TokenIdentityProvenanceUnknown.OnChainCreationOrderNotVerified,
            TokenIdentityProvenanceUnknown.OfficialIdentityNotVerified,
            TokenIdentityProvenanceUnknown.SocialTrendNotAnalyzed,
            TokenIdentityProvenanceUnknown.CopycatStatusNotDetermined
        };

        if (observation.NormalizedName is null && observation.NormalizedSymbol is null)
        {
            unknowns.Add(TokenIdentityProvenanceUnknown.ScannedIdentityFieldsMissing);
        }

        var (resultType, confidence) = DetermineResult(observation, collisions, isTruncated);

        var provenance = new TokenIdentityProvenance(
            Result: resultType,
            Confidence: confidence,
            ScannedIdentity: new TokenIdentityProvenanceScannedIdentity(
                Mint: observation.Mint,
                RawName: observation.RawName,
                NormalizedName: observation.NormalizedName,
                RawSymbol: observation.RawSymbol,
                NormalizedSymbol: observation.NormalizedSymbol,
                ObservedAtUtc: nowUtc),
            EarliestObservedMatch: earliest is null
                ? null
                : new EarliestObservedIdentityMatch(
                    Mint: earliest.CandidateMint,
                    ObservedAtUtc: earliest.FirstObservedAtUtc,
                    Semantics: EarliestObservedSemantics),
            Collisions: collisions,
            TotalCollisionCount: totalCount,
            ReturnedCollisionCount: returnedCount,
            IsTruncated: isTruncated,
            Evidence: evidence,
            ConflictingEvidence: conflictingEvidence,
            Unknowns: unknowns,
            AnalyzedAtUtc: nowUtc);

        return new TokenIdentityProvenanceResult(null, provenance);
    }

    private static (TokenIdentityProvenanceResultType Result, TokenIdentityProvenanceConfidence Confidence) DetermineResult(
        TokenIdentityObservation scanned,
        IReadOnlyList<TokenIdentityCollision> collisions,
        bool isTruncated)
    {
        if (scanned.NormalizedName is null && scanned.NormalizedSymbol is null)
        {
            return (TokenIdentityProvenanceResultType.InsufficientEvidence, TokenIdentityProvenanceConfidence.None);
        }

        if (collisions.Count == 0)
        {
            var confidence = scanned.NormalizedName is not null && scanned.NormalizedSymbol is not null
                ? TokenIdentityProvenanceConfidence.High
                : TokenIdentityProvenanceConfidence.Medium;
            return (TokenIdentityProvenanceResultType.NoMeaningfulCollisionFound, confidence);
        }

        var anyExact = collisions.Any(collision => collision.MatchLevel == TokenIdentityMatchLevel.Exact);
        if (!anyExact)
        {
            return (TokenIdentityProvenanceResultType.Ambiguous, TokenIdentityProvenanceConfidence.Low);
        }

        if (isTruncated)
        {
            return (TokenIdentityProvenanceResultType.CollisionObserved, TokenIdentityProvenanceConfidence.Medium);
        }

        return (TokenIdentityProvenanceResultType.CollisionObserved, TokenIdentityProvenanceConfidence.High);
    }

    private static List<TokenIdentityProvenanceEvidence> BuildEvidence(
        TokenIdentityObservation scanned,
        IReadOnlyList<TokenIdentityCollision> collisions,
        TokenIdentityCollision? earliest,
        bool isTruncated)
    {
        var evidence = new List<TokenIdentityProvenanceEvidence>();

        if (scanned.NormalizedName is not null)
        {
            evidence.Add(new TokenIdentityProvenanceEvidence(
                "OBSERVED_NORMALIZED_NAME",
                "TrainRekt normalized and stored the scanned token name for observed identity comparison."));
        }

        if (scanned.NormalizedSymbol is not null)
        {
            evidence.Add(new TokenIdentityProvenanceEvidence(
                "OBSERVED_NORMALIZED_SYMBOL",
                "TrainRekt normalized and stored the scanned token symbol for observed identity comparison."));
        }

        evidence.Add(new TokenIdentityProvenanceEvidence(
            collisions.Count > 0 ? "OBSERVED_MATCHING_MINTS_FOUND" : "OBSERVED_NO_MATCHING_MINTS_FOUND",
            collisions.Count > 0
                ? $"Found {collisions.Count} observed mint collision candidates in TrainRekt's local dataset."
                : "No observed mint collisions were found in TrainRekt's local dataset."));

        if (earliest is not null)
        {
            evidence.Add(new TokenIdentityProvenanceEvidence(
                "EARLIEST_OBSERVED_MATCH",
                "An earliest observed matching mint was identified using TrainRekt observation timestamps."));
        }

        if (isTruncated)
        {
            evidence.Add(new TokenIdentityProvenanceEvidence(
                "COLLISION_RESULTS_TRUNCATED",
                "Collision candidates were truncated by the configured response limit."));
        }

        return evidence;
    }

    private static List<TokenIdentityProvenanceEvidence> BuildConflictingEvidence(IReadOnlyList<TokenIdentityCollision> collisions)
    {
        var nameEarliest = collisions
            .Where(collision => collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Name))
            .OrderBy(collision => collision.FirstObservedAtUtc)
            .ThenBy(collision => collision.CandidateMint, StringComparer.Ordinal)
            .FirstOrDefault();

        var symbolEarliest = collisions
            .Where(collision => collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Symbol))
            .OrderBy(collision => collision.FirstObservedAtUtc)
            .ThenBy(collision => collision.CandidateMint, StringComparer.Ordinal)
            .FirstOrDefault();

        if (nameEarliest is null || symbolEarliest is null)
        {
            return new List<TokenIdentityProvenanceEvidence>();
        }

        if (string.Equals(nameEarliest.CandidateMint, symbolEarliest.CandidateMint, StringComparison.Ordinal))
        {
            return new List<TokenIdentityProvenanceEvidence>();
        }

        return new List<TokenIdentityProvenanceEvidence>
        {
            new(
                "NAME_SYMBOL_EARLIEST_MINT_MISMATCH",
                "The earliest observed name collision and earliest observed symbol collision point to different mints.")
        };
    }

    private static (IReadOnlyList<TokenIdentityMatchDimension> Dimensions, TokenIdentityMatchLevel MatchLevel) DetermineMatch(
        string? scannedRawName,
        string? scannedNormalizedName,
        string? scannedRawSymbol,
        string? scannedNormalizedSymbol,
        string? candidateRawName,
        string? candidateNormalizedName,
        string? candidateRawSymbol,
        string? candidateNormalizedSymbol)
    {
        var dimensions = new List<TokenIdentityMatchDimension>(2);
        var allExact = true;

        if (!string.IsNullOrWhiteSpace(scannedNormalizedName)
            && string.Equals(scannedNormalizedName, candidateNormalizedName, StringComparison.Ordinal))
        {
            dimensions.Add(TokenIdentityMatchDimension.Name);
            allExact &= string.Equals(scannedRawName, candidateRawName, StringComparison.Ordinal);
        }

        if (!string.IsNullOrWhiteSpace(scannedNormalizedSymbol)
            && string.Equals(scannedNormalizedSymbol, candidateNormalizedSymbol, StringComparison.Ordinal))
        {
            dimensions.Add(TokenIdentityMatchDimension.Symbol);
            allExact &= string.Equals(scannedRawSymbol, candidateRawSymbol, StringComparison.Ordinal);
        }

        return (
            dimensions,
            allExact ? TokenIdentityMatchLevel.Exact : TokenIdentityMatchLevel.NormalizedExact);
    }
}
