using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenIdentityProvenanceService : ITokenIdentityProvenanceService
{
    private const int ObservationVersion = 1;
    private const string EarliestObservedSemantics = "Among identities observed by TrainRekt, this mint was observed first for the matching normalized identity.";

    private readonly ITokenInspectionDeterministicService _inspectionService;
    private readonly ITokenIdentityObservationRepository _observationRepository;
    private readonly IOnChainChronologyService _chronologyService;
    private readonly ITrustedIdentityProvenanceService _trustedIdentityProvenanceService;
    private readonly ITokenIdentityClassifier _identityClassifier;
    private readonly TokenIdentityNormalizer _normalizer;
    private readonly TokenIdentityProvenanceOptions _options;
    private readonly TokenIdentityClassificationOptions _classificationOptions;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<TokenIdentityProvenanceService> _logger;

    public TokenIdentityProvenanceService(
        ITokenInspectionDeterministicService inspectionService,
        ITokenIdentityObservationRepository observationRepository,
        IOnChainChronologyService chronologyService,
        ITrustedIdentityProvenanceService trustedIdentityProvenanceService,
        ITokenIdentityClassifier identityClassifier,
        TokenIdentityNormalizer normalizer,
        IOptions<TokenIdentityProvenanceOptions> options,
        IOptions<TokenIdentityClassificationOptions> classificationOptions,
        TimeProvider timeProvider,
        ILogger<TokenIdentityProvenanceService> logger)
    {
        _inspectionService = inspectionService;
        _observationRepository = observationRepository;
        _chronologyService = chronologyService;
        _trustedIdentityProvenanceService = trustedIdentityProvenanceService;
        _identityClassifier = identityClassifier;
        _normalizer = normalizer;
        _options = options.Value;
        _classificationOptions = classificationOptions.Value;
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

        OnChainChronologyEvidence chronology;
        try
        {
            chronology = await _chronologyService.AnalyzeAsync(inspection.Identity.Mint, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "On-chain chronology analysis failed for mint {Mint}. Returning local observed provenance evidence.",
                inspection.Identity.Mint);
            chronology = CreateUnavailableChronology(nowUtc);
        }

        TrustedIdentityProvenance trustedIdentityProvenance;
        try
        {
            trustedIdentityProvenance = await _trustedIdentityProvenanceService.AnalyzeAsync(
                new TrustedIdentityProvenanceRequest(
                    ScannedMint: inspection.Identity.Mint,
                    ScannedMetadataUri: inspection.Identity.MetadataUri,
                    Collisions: collisions,
                    AnalyzedAtUtc: nowUtc),
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Trusted identity provenance analysis failed for mint {Mint}. Returning observed and chronology evidence.",
                inspection.Identity.Mint);
            trustedIdentityProvenance = CreateUnavailableTrustedIdentityProvenance(nowUtc);
        }

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

        ApplyChronologyUnknowns(unknowns, chronology);
        ApplyTrustedIdentityUnknowns(unknowns, trustedIdentityProvenance);

        var (resultType, confidence) = DetermineResult(observation, collisions, isTruncated, trustedIdentityProvenance);

        var competingChronologies = await AnalyzeCompetingChronologiesAsync(
            observation,
            collisions,
            trustedIdentityProvenance,
            nowUtc,
            cancellationToken);

        var baseProvenance = new TokenIdentityProvenance(
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
            AnalyzedAtUtc: nowUtc,
            OnChainChronology: chronology,
            TrustedIdentityProvenance: trustedIdentityProvenance,
            CompetingMintChronologies: competingChronologies);

        var identityClassification = _identityClassifier.Classify(baseProvenance);
        var provenance = baseProvenance with
        {
            IdentityClassification = identityClassification
        };

        return new TokenIdentityProvenanceResult(null, provenance);
    }

    private async Task<IReadOnlyList<CompetingMintChronologyEvidence>> AnalyzeCompetingChronologiesAsync(
        TokenIdentityObservation observation,
        IReadOnlyList<TokenIdentityCollision> collisions,
        TrustedIdentityProvenance trustedIdentityProvenance,
        DateTimeOffset analyzedAtUtc,
        CancellationToken cancellationToken)
    {
        if (observation.NormalizedName is null && observation.NormalizedSymbol is null)
        {
            return Array.Empty<CompetingMintChronologyEvidence>();
        }

        if (collisions.Count == 0
            || trustedIdentityProvenance.Conflicts.Count > 0
            || trustedIdentityProvenance.Unknowns.Contains(TrustedIdentityProvenanceUnknown.IdentitySourceConflict))
        {
            return Array.Empty<CompetingMintChronologyEvidence>();
        }

        var hasTrustedScanned = trustedIdentityProvenance.Sources.Any(source =>
            source.SourceTrust == IdentitySourceTrust.Trusted
            && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesScannedMint);

        if (hasTrustedScanned)
        {
            return Array.Empty<CompetingMintChronologyEvidence>();
        }

        var competitorCandidates = SelectClassificationCompetitors(collisions, trustedIdentityProvenance);
        if (competitorCandidates.Count == 0)
        {
            return Array.Empty<CompetingMintChronologyEvidence>();
        }

        var selectedCompetitors = competitorCandidates
            .Take(_classificationOptions.MaxClassificationCompetitors)
            .ToArray();

        var chronologyResults = new List<CompetingMintChronologyEvidence>(selectedCompetitors.Length);
        foreach (var competitorMint in selectedCompetitors)
        {
            cancellationToken.ThrowIfCancellationRequested();

            OnChainChronologyEvidence chronology;
            try
            {
                chronology = await _chronologyService.AnalyzeAsync(competitorMint, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Competing mint chronology analysis failed for mint {Mint}. Classification will degrade conservatively.",
                    competitorMint);
                chronology = CreateUnavailableChronology(analyzedAtUtc);
            }

            chronologyResults.Add(new CompetingMintChronologyEvidence(competitorMint, chronology));
        }

        return chronologyResults;
    }

    private static IReadOnlyList<string> SelectClassificationCompetitors(
        IReadOnlyList<TokenIdentityCollision> collisions,
        TrustedIdentityProvenance trustedIdentityProvenance)
    {
        var trustedCompetingReferences = trustedIdentityProvenance.Sources
            .Where(source => source.SourceTrust == IdentitySourceTrust.Trusted
                && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesCompetingMint)
            .SelectMany(source => source.ReferencedRelevantMints)
            .Distinct(StringComparer.Ordinal)
            .ToHashSet(StringComparer.Ordinal);

        if (trustedCompetingReferences.Count == 0)
        {
            return Array.Empty<string>();
        }

        return collisions
            .Where(collision => trustedCompetingReferences.Contains(collision.CandidateMint)
                && collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Name))
            .OrderBy(collision => CollisionStrength(collision))
            .ThenBy(collision => collision.FirstObservedAtUtc)
            .ThenBy(collision => collision.CandidateMint, StringComparer.Ordinal)
            .Select(collision => collision.CandidateMint)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }

    private static int CollisionStrength(TokenIdentityCollision collision)
    {
        var hasName = collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Name);
        var hasSymbol = collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Symbol);

        if (hasName && hasSymbol)
        {
            return 0;
        }

        return hasName ? 1 : 2;
    }

    private static void ApplyChronologyUnknowns(List<TokenIdentityProvenanceUnknown> unknowns, OnChainChronologyEvidence chronology)
    {
        foreach (var chronologyUnknown in chronology.Unknowns)
        {
            var mapped = chronologyUnknown switch
            {
                OnChainChronologyUnknown.CanonicalCreationTimeNotProven => TokenIdentityProvenanceUnknown.CanonicalCreationTimeNotProven,
                OnChainChronologyUnknown.ChainHistoryPartial => TokenIdentityProvenanceUnknown.ChainHistoryPartial,
                OnChainChronologyUnknown.ChainHistoryUnavailable => TokenIdentityProvenanceUnknown.ChainHistoryUnavailable,
                OnChainChronologyUnknown.BlockTimeUnavailable => TokenIdentityProvenanceUnknown.BlockTimeUnavailable,
                _ => TokenIdentityProvenanceUnknown.ProviderRetentionUnknown
            };

            if (!unknowns.Contains(mapped))
            {
                unknowns.Add(mapped);
            }
        }

        if (chronology.EarliestObservedSlot is not null)
        {
            unknowns.Remove(TokenIdentityProvenanceUnknown.OnChainCreationOrderNotVerified);
        }
    }

    private static void ApplyTrustedIdentityUnknowns(
        List<TokenIdentityProvenanceUnknown> unknowns,
        TrustedIdentityProvenance trustedIdentityProvenance)
    {
        foreach (var trustedUnknown in trustedIdentityProvenance.Unknowns)
        {
            var mapped = trustedUnknown switch
            {
                TrustedIdentityProvenanceUnknown.NoIdentitySourceAvailable => TokenIdentityProvenanceUnknown.NoIdentitySourceAvailable,
                TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable => TokenIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable,
                TrustedIdentityProvenanceUnknown.SourceFetchPartial => TokenIdentityProvenanceUnknown.SourceFetchPartial,
                TrustedIdentityProvenanceUnknown.IdentitySourceConflict => TokenIdentityProvenanceUnknown.IdentitySourceConflict,
                _ => TokenIdentityProvenanceUnknown.OfficialIdentityNotVerified
            };

            if (!unknowns.Contains(mapped))
            {
                unknowns.Add(mapped);
            }
        }

        var hasTrustedScannedMintEvidence = trustedIdentityProvenance.Sources.Any(source =>
            source.SourceTrust == IdentitySourceTrust.Trusted
            && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesScannedMint);

        if (hasTrustedScannedMintEvidence)
        {
            unknowns.Remove(TokenIdentityProvenanceUnknown.OfficialIdentityNotVerified);
        }
    }

    private static OnChainChronologyEvidence CreateUnavailableChronology(DateTimeOffset analyzedAtUtc)
    {
        return new OnChainChronologyEvidence(
            EarliestObservedSignature: null,
            EarliestObservedSlot: null,
            EarliestObservedBlockTimeUtc: null,
            HistoryCoverage: OnChainChronologyCoverage.Unavailable,
            PaginationExhausted: false,
            PagesScanned: 0,
            SignaturesScanned: 0,
            Source: "HELIUS_SOLANA_RPC",
            Confidence: OnChainChronologyConfidence.None,
            Precision: OnChainChronologyPrecision.ObservedTransactionOnly,
            AccountCreationProven: false,
            Unknowns: new[]
            {
                OnChainChronologyUnknown.CanonicalCreationTimeNotProven,
                OnChainChronologyUnknown.ChainHistoryUnavailable
            },
            AnalyzedAtUtc: analyzedAtUtc);
    }

    private static TrustedIdentityProvenance CreateUnavailableTrustedIdentityProvenance(DateTimeOffset analyzedAtUtc)
    {
        return new TrustedIdentityProvenance(
            Sources: Array.Empty<IdentitySourceEvidence>(),
            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Unknowns: new[]
            {
                TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable,
                TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified,
                TrustedIdentityProvenanceUnknown.SourceFetchPartial
            },
            AnalyzedAtUtc: analyzedAtUtc);
    }

    private static (TokenIdentityProvenanceResultType Result, TokenIdentityProvenanceConfidence Confidence) DetermineResult(
        TokenIdentityObservation scanned,
        IReadOnlyList<TokenIdentityCollision> collisions,
        bool isTruncated,
        TrustedIdentityProvenance trustedIdentityProvenance)
    {
        var hasTrustedIdentityConflict = trustedIdentityProvenance.Conflicts.Count > 0;

        if (scanned.NormalizedName is null && scanned.NormalizedSymbol is null)
        {
            return (TokenIdentityProvenanceResultType.InsufficientEvidence, TokenIdentityProvenanceConfidence.None);
        }

        if (collisions.Count == 0)
        {
            var confidence = scanned.NormalizedName is not null && scanned.NormalizedSymbol is not null
                ? TokenIdentityProvenanceConfidence.High
                : TokenIdentityProvenanceConfidence.Medium;

            if (hasTrustedIdentityConflict)
            {
                return (TokenIdentityProvenanceResultType.Ambiguous, TokenIdentityProvenanceConfidence.Low);
            }

            return (TokenIdentityProvenanceResultType.NoMeaningfulCollisionFound, confidence);
        }

        var anyExact = collisions.Any(collision => collision.MatchLevel == TokenIdentityMatchLevel.Exact);
        if (!anyExact)
        {
            return (TokenIdentityProvenanceResultType.Ambiguous, TokenIdentityProvenanceConfidence.Low);
        }

        if (hasTrustedIdentityConflict)
        {
            return (TokenIdentityProvenanceResultType.Ambiguous, TokenIdentityProvenanceConfidence.Medium);
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
