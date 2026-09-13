using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public sealed class TokenResearchOrchestrator : ITokenResearchOrchestrator
{
    private readonly ITokenResearchProvider _provider;
    private readonly IResearchTrustAssessor _trustAssessor;
    private readonly ITokenResearchRepository _repository;
    private readonly ResearchNeedDetector _needDetector;
    private readonly ResearchRequestFactory _requestFactory;
    private readonly CandidateResearchPromoter _promoter;
    private readonly DeterministicResearchVerifier _verifier;
    private readonly ProtocolResearchContextMerger _merger;
    private readonly TimeProvider _timeProvider;
    private readonly TokenResearchOptions _options;
    private readonly ILogger<TokenResearchOrchestrator> _logger;

    public TokenResearchOrchestrator(
        ITokenResearchProvider provider,
        IResearchTrustAssessor trustAssessor,
        ITokenResearchRepository repository,
        ResearchNeedDetector needDetector,
        ResearchRequestFactory requestFactory,
        CandidateResearchPromoter promoter,
        DeterministicResearchVerifier verifier,
        ProtocolResearchContextMerger merger,
        TimeProvider timeProvider,
        IOptions<TokenResearchOptions> options,
        ILogger<TokenResearchOrchestrator> logger)
    {
        _provider = provider;
        _trustAssessor = trustAssessor;
        _repository = repository;
        _needDetector = needDetector;
        _requestFactory = requestFactory;
        _promoter = promoter;
        _verifier = verifier;
        _merger = merger;
        _timeProvider = timeProvider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<ResearchOutcome> RunAsync(TokenInspection inspection, CancellationToken cancellationToken)
    {
        var needs = _needDetector.Detect(inspection);
        if (needs.Count == 0)
        {
            return new ResearchOutcome(ResearchOutcomeStatus.NotRequired, needs, 0, 0, 0, inspection.ProtocolContext, false);
        }

        var nowUtc = _timeProvider.GetUtcNow();
        CachedTokenResearchSnapshot? freshSnapshot;
        try
        {
            freshSnapshot = await _repository.GetLatestFreshAsync(
                inspection.Identity.Mint,
                TokenResearchVersion.Current,
                nowUtc,
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
                "Token research cache lookup failed for mint {Mint}. Research enrichment skipped.",
                inspection.Identity.Mint);

            return CreateFailedOutcome(needs, inspection);
        }

        if (freshSnapshot is not null)
        {
            var cacheMerge = _merger.Merge(inspection.ProtocolContext, freshSnapshot.Context);
            return new ResearchOutcome(ResearchOutcomeStatus.Completed, needs, 0, 0, cacheMerge.ClaimsRejected, cacheMerge.Context, true);
        }

        var request = _requestFactory.Create(inspection, needs);
        CandidateResearchResult candidate;
        try
        {
            using var timeoutCts = CreateTimeoutCancellation(cancellationToken);
            candidate = await _provider.ResearchAsync(request, timeoutCts.Token);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Token research provider failed for mint {Mint}. Research enrichment skipped.",
                request.Mint);

            return CreateFailedOutcome(needs, inspection);
        }

        _logger.LogInformation(
            "Token research candidate received for mint {Mint}. Candidate sources {SourceCount}, claims {ClaimCount}.",
            request.Mint,
            candidate.Sources.Count,
            candidate.Claims.Count);

        ResearchTrustAssessment trustAssessment;
        try
        {
            trustAssessment = await _trustAssessor.AssessAsync(request, candidate, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Token research trust assessment failed for mint {Mint}. Research enrichment skipped.",
                request.Mint);

            return CreateFailedOutcome(needs, inspection);
        }

        var promoted = _promoter.Promote(request, candidate, trustAssessment);
        if (!promoted.IsValid)
        {
            return new ResearchOutcome(ResearchOutcomeStatus.InvalidCandidateData, needs, 0, 0, candidate.Claims.Count, inspection.ProtocolContext, false);
        }

        if (!promoted.HasUsableContent || promoted.Context is null)
        {
            return new ResearchOutcome(
                ResearchOutcomeStatus.NoUsableSources,
                needs,
                promoted.SourcesAccepted,
                promoted.ClaimsAccepted,
                promoted.ClaimsRejected,
                inspection.ProtocolContext,
                false);
        }

        var reconciled = _verifier.Reconcile(inspection, promoted.Context);
        var merged = _merger.Merge(inspection.ProtocolContext, reconciled);

        if (promoted.ClaimsAccepted > 0 && merged.Context is not null)
        {
            var expiresAtUtc = nowUtc.AddHours(_options.FreshnessHours);
            var snapshot = new CachedTokenResearchSnapshot(
                Id: string.Empty,
                Mint: inspection.Identity.Mint,
                Protocol: merged.Context.Protocol,
                ResearchVersion: TokenResearchVersion.Current,
                ResearchedAtUtc: nowUtc,
                CachedAtUtc: nowUtc,
                ExpiresAtUtc: expiresAtUtc,
                Context: merged.Context);

            try
            {
                await _repository.InsertAsync(snapshot, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Token research cache persist failed for mint {Mint}. Returning current enrichment without cache write.",
                    inspection.Identity.Mint);
            }
        }

        return new ResearchOutcome(
            ResearchOutcomeStatus.Completed,
            needs,
            promoted.SourcesAccepted,
            promoted.ClaimsAccepted,
            promoted.ClaimsRejected + merged.ClaimsRejected,
            merged.Context,
            false);
    }

    private CancellationTokenSource CreateTimeoutCancellation(CancellationToken cancellationToken)
    {
        if (_options.ProviderTimeoutSeconds <= 0)
        {
            return CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        }

        var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(_options.ProviderTimeoutSeconds));
        return timeoutCts;
    }

    private static ResearchOutcome CreateFailedOutcome(IReadOnlyList<ResearchNeed> needs, TokenInspection inspection)
    {
        return new ResearchOutcome(
            ResearchOutcomeStatus.Failed,
            needs,
            0,
            0,
            0,
            inspection.ProtocolContext,
            false);
    }
}
