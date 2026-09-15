using System.Diagnostics;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenInspectionCoachService : ITokenInspectionCoachService
{
    private readonly ITokenInspectionCoreService _inspectionService;
    private readonly ITokenIdentityProvenanceService _provenanceService;
    private readonly IAiSafetyCoach _coach;
    private readonly ITokenExternalContextResearchService _externalContextService;
    private readonly IAiSafetyCoachSnapshotRepository _snapshotRepository;
    private readonly AiSafetyCoachInputFactory _inputFactory;
    private readonly AiSafetyCoachContentNormalizer _contentNormalizer;
    private readonly AiSafetyCoachResponseValidator _responseValidator;
    private readonly AiSafetyCoachOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<TokenInspectionCoachService> _logger;

    public TokenInspectionCoachService(
        ITokenInspectionCoreService inspectionService,
        ITokenIdentityProvenanceService provenanceService,
        IAiSafetyCoach coach,
        ITokenExternalContextResearchService externalContextService,
        IAiSafetyCoachSnapshotRepository snapshotRepository,
        AiSafetyCoachInputFactory inputFactory,
        AiSafetyCoachContentNormalizer contentNormalizer,
        AiSafetyCoachResponseValidator responseValidator,
        IOptions<AiSafetyCoachOptions> options,
        TimeProvider timeProvider,
        ILogger<TokenInspectionCoachService> logger)
    {
        _inspectionService = inspectionService;
        _provenanceService = provenanceService;
        _coach = coach;
        _externalContextService = externalContextService;
        _snapshotRepository = snapshotRepository;
        _inputFactory = inputFactory;
        _contentNormalizer = contentNormalizer;
        _responseValidator = responseValidator;
        _options = options.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<TokenInspectionCoachResult> GenerateAsync(string mint, CancellationToken cancellationToken)
    {
        var totalCoachStopwatch = Stopwatch.StartNew();
        long inspectionMs = 0;
        long provenanceMs = 0;
        long externalContextMs = 0;
        long cacheMs = 0;
        long geminiCoachMs = 0;

        _logger.LogInformation("AI safety coach generation started for mint {Mint}.", mint);
        _logger.LogInformation(
            "AI coach effective limits: maxSummaryLength={MaxSummaryLength} maxSummarySentences={MaxSummarySentences} maxOutputTokens={MaxOutputTokens} maxRiskExplanations={MaxRiskExplanations} maxWhatToCheckNext={MaxWhatToCheckNext} maxUncertaintyItems={MaxUncertaintyItems}.",
            _options.MaxSummaryLength,
            _options.MaxSummarySentences,
            _options.MaxOutputTokens,
            _options.MaxRiskExplanations,
            _options.MaxWhatToCheckNext,
            _options.MaxUncertaintyItems);

        if (!SolanaPublicKeyValidator.TryNormalize(mint, out var normalizedMint))
        {
            _logger.LogInformation(
                "AI coach timing for mint {Mint}: totalCoachMs={TotalCoachMs} inspectionMs={InspectionMs} provenanceMs={ProvenanceMs} externalContextMs={ExternalContextMs} cacheMs={CacheMs} geminiCoachMs={GeminiCoachMs} outcome={Outcome}.",
                mint,
                ElapsedMilliseconds(totalCoachStopwatch),
                inspectionMs,
                provenanceMs,
                externalContextMs,
                cacheMs,
                geminiCoachMs,
                "invalid-mint");

            return new TokenInspectionCoachResult(
                new TokenInspectionError(TokenInspectionErrorCode.InvalidMint, "The provided mint is not a syntactically valid Solana public key."),
                AiSafetyCoachStatus.Unavailable,
                null);
        }

        var nowUtc = _timeProvider.GetUtcNow();
        var language = _options.Language;

        var inspectionStopwatch = Stopwatch.StartNew();
        var inspectionResult = await _inspectionService.InspectAsync(normalizedMint, cancellationToken);
        inspectionMs = ElapsedMilliseconds(inspectionStopwatch);
        if (inspectionResult.Error is not null)
        {
            _logger.LogInformation(
                "AI coach timing for mint {Mint}: totalCoachMs={TotalCoachMs} inspectionMs={InspectionMs} provenanceMs={ProvenanceMs} externalContextMs={ExternalContextMs} cacheMs={CacheMs} geminiCoachMs={GeminiCoachMs} outcome={Outcome}.",
                normalizedMint,
                ElapsedMilliseconds(totalCoachStopwatch),
                inspectionMs,
                provenanceMs,
                externalContextMs,
                cacheMs,
                geminiCoachMs,
                "inspection-error");
            return new TokenInspectionCoachResult(inspectionResult.Error, AiSafetyCoachStatus.Unavailable, null);
        }

        if (inspectionResult.Inspection is null)
        {
            _logger.LogInformation(
                "AI coach timing for mint {Mint}: totalCoachMs={TotalCoachMs} inspectionMs={InspectionMs} provenanceMs={ProvenanceMs} externalContextMs={ExternalContextMs} cacheMs={CacheMs} geminiCoachMs={GeminiCoachMs} outcome={Outcome}.",
                normalizedMint,
                ElapsedMilliseconds(totalCoachStopwatch),
                inspectionMs,
                provenanceMs,
                externalContextMs,
                cacheMs,
                geminiCoachMs,
                "inspection-null");
            return new TokenInspectionCoachResult(
                new TokenInspectionError(TokenInspectionErrorCode.ProviderMalformedResponse, "Token inspection produced no result."),
                AiSafetyCoachStatus.Unavailable,
                null);
        }

        var inspection = inspectionResult.Inspection;
        TokenIdentityProvenance? provenance = null;
        var provenanceStopwatch = Stopwatch.StartNew();
        try
        {
            var provenanceResult = await _provenanceService.AnalyzeFromInspectionAsync(inspection, cancellationToken);
            provenance = provenanceResult.Provenance;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Identity provenance enrichment was unavailable for AI coach mint {Mint}. Continuing with deterministic base facts only.",
                inspection.Identity.Mint);
        }
        finally
        {
            provenanceMs = ElapsedMilliseconds(provenanceStopwatch);
        }

        // Fingerprint over deterministic + provenance facts only (no external context), so this
        // exact value can validate the cache now and be reused as the persisted fingerprint below.
        var dependencyFingerprint = AiSafetyCoachFingerprint.ComputeCoachDependencyFingerprint(
            _inputFactory.Create(inspection, provenance));

        var earlyCacheStopwatch = Stopwatch.StartNew();
        try
        {
            var earlyCached = await _snapshotRepository.GetFreshAsync(
                normalizedMint,
                language,
                AiSafetyCoachVersion.Current,
                dependencyFingerprint,
                nowUtc,
                cancellationToken);

            cacheMs = ElapsedMilliseconds(earlyCacheStopwatch);

            if (earlyCached is not null)
            {
                _logger.LogInformation(
                    "AI coach timing for mint {Mint}: totalCoachMs={TotalCoachMs} inspectionMs={InspectionMs} provenanceMs={ProvenanceMs} externalContextMs={ExternalContextMs} cacheMs={CacheMs} geminiCoachMs={GeminiCoachMs} outcome={Outcome}.",
                    normalizedMint,
                    ElapsedMilliseconds(totalCoachStopwatch),
                    inspectionMs,
                    provenanceMs,
                    externalContextMs,
                    cacheMs,
                    geminiCoachMs,
                    "cache-hit");

                return new TokenInspectionCoachResult(null, AiSafetyCoachStatus.Available, earlyCached.Coach);
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            cacheMs = ElapsedMilliseconds(earlyCacheStopwatch);
            _logger.LogWarning(
                exception,
                "AI safety coach cache read failed for mint {Mint}. Returning safe unavailable state.",
                normalizedMint);
            _logger.LogInformation(
                "AI coach timing for mint {Mint}: totalCoachMs={TotalCoachMs} inspectionMs={InspectionMs} provenanceMs={ProvenanceMs} externalContextMs={ExternalContextMs} cacheMs={CacheMs} geminiCoachMs={GeminiCoachMs} outcome={Outcome}.",
                normalizedMint,
                ElapsedMilliseconds(totalCoachStopwatch),
                inspectionMs,
                provenanceMs,
                externalContextMs,
                cacheMs,
                geminiCoachMs,
                "cache-read-failure");
            return new TokenInspectionCoachResult(null, AiSafetyCoachStatus.CacheUnavailable, null);
        }

        TokenExternalContext? externalContext = null;
        var externalContextStopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("External context research started for mint {Mint}.", inspection.Identity.Mint);
            externalContext = await _externalContextService.GetContextAsync(inspection, provenance, cancellationToken);
            _logger.LogInformation(
                "External context research completed for mint {Mint}. availability={Availability} assetType={AssetType} mintConfirmed={MintConfirmed} confidence={Confidence} evidenceCount={EvidenceCount} failureReason={FailureReason}.",
                inspection.Identity.Mint,
                externalContext.Availability,
                externalContext.AssetType,
                externalContext.MintConfirmed,
                externalContext.Confidence,
                externalContext.Evidence.Count,
                externalContext.FailureReason);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "External context enrichment failed for AI coach mint {Mint}. Continuing with deterministic base facts only.",
                inspection.Identity.Mint);
        }
        finally
        {
            externalContextMs = ElapsedMilliseconds(externalContextStopwatch);
        }

        var input = _inputFactory.Create(inspection, provenance, externalContext);

        var geminiCoachStopwatch = Stopwatch.StartNew();
        var modelResult = await _coach.GenerateAsync(input, cancellationToken);
        geminiCoachMs = ElapsedMilliseconds(geminiCoachStopwatch);
        if (!modelResult.Success || modelResult.Content is null)
        {
            var status = MapFailure(modelResult.FailureReason);
            _logger.LogWarning(
                "AI safety coach model stage failed for mint {Mint}. mappedStatus={MappedStatus} failureReason={FailureReason} httpStatus={HttpStatusCode} detail={Detail} totalCoachMs={TotalCoachMs} inspectionMs={InspectionMs} provenanceMs={ProvenanceMs} externalContextMs={ExternalContextMs} cacheMs={CacheMs} geminiCoachMs={GeminiCoachMs}.",
                inspection.Identity.Mint,
                status,
                modelResult.FailureReason,
                modelResult.HttpStatusCode,
                modelResult.Detail,
                ElapsedMilliseconds(totalCoachStopwatch),
                inspectionMs,
                provenanceMs,
                externalContextMs,
                cacheMs,
                geminiCoachMs);
            return new TokenInspectionCoachResult(null, status, null);
        }

        var normalizationResult = _contentNormalizer.Normalize(modelResult.Content);
        foreach (var normalizationEvent in normalizationResult.Events)
        {
            _logger.LogDebug(
                "AI coach list item normalized. section={Section} originalLength={OriginalLength} normalizedLength={NormalizedLength}.",
                normalizationEvent.Section,
                normalizationEvent.OriginalLength,
                normalizationEvent.NormalizedLength);
        }

        var normalizedContent = normalizationResult.Content;

        var summaryDiagnostics = _responseValidator.DescribeSummary(normalizedContent);
        _logger.LogInformation(
            "AI coach summary validation: length={Length} maxLength={MaxLength} sentences={Sentences} isEmpty={IsEmpty}.",
            summaryDiagnostics.Length,
            summaryDiagnostics.MaxLength,
            summaryDiagnostics.Sentences,
            summaryDiagnostics.IsEmpty);

        if (!_responseValidator.TryValidate(normalizedContent, out var validationReason))
        {
            _logger.LogWarning(
                "AI safety coach validation failed for mint {Mint}. reason={Reason}.",
                inspection.Identity.Mint,
                validationReason);
            return new TokenInspectionCoachResult(null, AiSafetyCoachStatus.InvalidResponse, null);
        }

        var payload = new AiSafetyCoachPayload(
            Content: normalizedContent,
            CoachVersion: AiSafetyCoachVersion.Current,
            GeneratedAtUtc: nowUtc);

        var snapshot = new CachedTokenInspectionCoachSnapshot(
            Id: string.Empty,
            Mint: normalizedMint,
            Language: language,
            CoachVersion: AiSafetyCoachVersion.Current,
            InputFingerprint: dependencyFingerprint,
            CachedAtUtc: nowUtc,
            ExpiresAtUtc: nowUtc.AddHours(_options.FreshnessHours),
            Coach: payload);

        try
        {
            await _snapshotRepository.InsertAsync(snapshot, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "AI safety coach cache write failed for mint {Mint}. Returning current valid coach response.",
                inspection.Identity.Mint);
        }

        _logger.LogInformation(
            "AI safety coach generation completed for mint {Mint}. status={Status} totalCoachMs={TotalCoachMs} inspectionMs={InspectionMs} provenanceMs={ProvenanceMs} externalContextMs={ExternalContextMs} cacheMs={CacheMs} geminiCoachMs={GeminiCoachMs}.",
            inspection.Identity.Mint,
            AiSafetyCoachStatus.Available,
            ElapsedMilliseconds(totalCoachStopwatch),
            inspectionMs,
            provenanceMs,
            externalContextMs,
            cacheMs,
            geminiCoachMs);
        return new TokenInspectionCoachResult(null, AiSafetyCoachStatus.Available, payload);
    }

    private static AiSafetyCoachStatus MapFailure(AiSafetyCoachFailureReason? reason)
    {
        return reason switch
        {
            AiSafetyCoachFailureReason.Disabled or AiSafetyCoachFailureReason.MissingApiKey => AiSafetyCoachStatus.Disabled,
            AiSafetyCoachFailureReason.MalformedResponse or AiSafetyCoachFailureReason.SchemaViolation or AiSafetyCoachFailureReason.ValidationFailed or AiSafetyCoachFailureReason.OutputTruncated => AiSafetyCoachStatus.InvalidResponse,
            _ => AiSafetyCoachStatus.Unavailable
        };
    }

    private static long ElapsedMilliseconds(Stopwatch stopwatch)
    {
        return (long)Math.Round(stopwatch.Elapsed.TotalMilliseconds, MidpointRounding.AwayFromZero);
    }
}