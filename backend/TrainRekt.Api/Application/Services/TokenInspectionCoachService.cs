using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenInspectionCoachService : ITokenInspectionCoachService
{
    private readonly ITokenInspectionService _inspectionService;
    private readonly ITokenIdentityProvenanceService _provenanceService;
    private readonly IAiSafetyCoach _coach;
    private readonly ITokenExternalContextResearchService _externalContextService;
    private readonly IAiSafetyCoachSnapshotRepository _snapshotRepository;
    private readonly AiSafetyCoachInputFactory _inputFactory;
    private readonly AiSafetyCoachResponseValidator _responseValidator;
    private readonly AiSafetyCoachOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<TokenInspectionCoachService> _logger;

    public TokenInspectionCoachService(
        ITokenInspectionService inspectionService,
        ITokenIdentityProvenanceService provenanceService,
        IAiSafetyCoach coach,
        ITokenExternalContextResearchService externalContextService,
        IAiSafetyCoachSnapshotRepository snapshotRepository,
        AiSafetyCoachInputFactory inputFactory,
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
        _responseValidator = responseValidator;
        _options = options.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<TokenInspectionCoachResult> GenerateAsync(string mint, CancellationToken cancellationToken)
    {
        _logger.LogInformation("AI safety coach generation started for mint {Mint}.", mint);
        _logger.LogInformation(
            "AI coach effective limits: maxSummaryLength={MaxSummaryLength} maxSummarySentences={MaxSummarySentences} maxOutputTokens={MaxOutputTokens} maxRiskExplanations={MaxRiskExplanations} maxWhatToCheckNext={MaxWhatToCheckNext} maxUncertaintyItems={MaxUncertaintyItems}.",
            _options.MaxSummaryLength,
            _options.MaxSummarySentences,
            _options.MaxOutputTokens,
            _options.MaxRiskExplanations,
            _options.MaxWhatToCheckNext,
            _options.MaxUncertaintyItems);

        var inspectionResult = await _inspectionService.InspectAsync(mint, cancellationToken);
        if (inspectionResult.Error is not null)
        {
            return new TokenInspectionCoachResult(inspectionResult.Error, AiSafetyCoachStatus.Unavailable, null);
        }

        if (inspectionResult.Inspection is null)
        {
            return new TokenInspectionCoachResult(
                new TokenInspectionError(TokenInspectionErrorCode.ProviderMalformedResponse, "Token inspection produced no result."),
                AiSafetyCoachStatus.Unavailable,
                null);
        }

        var inspection = inspectionResult.Inspection;
        TokenIdentityProvenance? provenance = null;
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

        var nowUtc = _timeProvider.GetUtcNow();
        TokenExternalContext? externalContext = null;
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

        var input = _inputFactory.Create(inspection, provenance, externalContext);
        var language = _options.Language;
        var fingerprint = AiSafetyCoachFingerprint.Compute(input);

        try
        {
            var cached = await _snapshotRepository.GetFreshAsync(
                inspection.Identity.Mint,
                language,
                AiSafetyCoachVersion.Current,
                fingerprint,
                nowUtc,
                cancellationToken);

            if (cached is not null)
            {
                return new TokenInspectionCoachResult(null, AiSafetyCoachStatus.Available, cached.Coach);
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "AI safety coach cache read failed for mint {Mint}. Returning safe unavailable state.",
                inspection.Identity.Mint);
            return new TokenInspectionCoachResult(null, AiSafetyCoachStatus.CacheUnavailable, null);
        }

        var modelResult = await _coach.GenerateAsync(input, cancellationToken);
        if (!modelResult.Success || modelResult.Content is null)
        {
            var status = MapFailure(modelResult.FailureReason);
            _logger.LogWarning(
                "AI safety coach model stage failed for mint {Mint}. mappedStatus={MappedStatus} failureReason={FailureReason} httpStatus={HttpStatusCode} detail={Detail}.",
                inspection.Identity.Mint,
                status,
                modelResult.FailureReason,
                modelResult.HttpStatusCode,
                modelResult.Detail);
            return new TokenInspectionCoachResult(null, status, null);
        }

        var summaryDiagnostics = _responseValidator.DescribeSummary(modelResult.Content);
        _logger.LogInformation(
            "AI coach summary validation: length={Length} maxLength={MaxLength} sentences={Sentences} isEmpty={IsEmpty}.",
            summaryDiagnostics.Length,
            summaryDiagnostics.MaxLength,
            summaryDiagnostics.Sentences,
            summaryDiagnostics.IsEmpty);

        if (!_responseValidator.TryValidate(modelResult.Content, out var validationReason))
        {
            _logger.LogWarning(
                "AI safety coach validation failed for mint {Mint}. reason={Reason}.",
                inspection.Identity.Mint,
                validationReason);
            return new TokenInspectionCoachResult(null, AiSafetyCoachStatus.InvalidResponse, null);
        }

        var payload = new AiSafetyCoachPayload(
            Content: modelResult.Content,
            CoachVersion: AiSafetyCoachVersion.Current,
            GeneratedAtUtc: nowUtc);

        var snapshot = new CachedTokenInspectionCoachSnapshot(
            Id: string.Empty,
            Mint: inspection.Identity.Mint,
            Language: language,
            CoachVersion: AiSafetyCoachVersion.Current,
            InputFingerprint: fingerprint,
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

        _logger.LogInformation("AI safety coach generation completed for mint {Mint}. status={Status}.", inspection.Identity.Mint, AiSafetyCoachStatus.Available);
        return new TokenInspectionCoachResult(null, AiSafetyCoachStatus.Available, payload);
    }

    private static AiSafetyCoachStatus MapFailure(AiSafetyCoachFailureReason? reason)
    {
        return reason switch
        {
            AiSafetyCoachFailureReason.Disabled or AiSafetyCoachFailureReason.MissingApiKey => AiSafetyCoachStatus.Disabled,
            AiSafetyCoachFailureReason.MalformedResponse or AiSafetyCoachFailureReason.SchemaViolation or AiSafetyCoachFailureReason.ValidationFailed => AiSafetyCoachStatus.InvalidResponse,
            _ => AiSafetyCoachStatus.Unavailable
        };
    }
}