using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Application.Services;

public sealed class TrustedIdentityProvenanceService : ITrustedIdentityProvenanceService
{
    private readonly IdentitySourceCandidateExtractor _candidateExtractor;
    private readonly ITrustedProjectPolicyResolver _projectPolicyResolver;
    private readonly ISafeResearchSourceClient _safeSourceClient;
    private readonly ITokenIdentitySourceVerificationSnapshotRepository _snapshotRepository;
    private readonly ITrustedMintSourceRegistry _trustedRegistry;
    private readonly TrustedSourceClassifier _trustedSourceClassifier;
    private readonly ResearchContentNormalizer _contentNormalizer;
    private readonly SolanaMintEvidenceMatcher _mintMatcher;
    private readonly TrustedIdentityProvenanceOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<TrustedIdentityProvenanceService> _logger;

    public TrustedIdentityProvenanceService(
        IdentitySourceCandidateExtractor candidateExtractor,
        ITrustedProjectPolicyResolver projectPolicyResolver,
        ISafeResearchSourceClient safeSourceClient,
        ITokenIdentitySourceVerificationSnapshotRepository snapshotRepository,
        ITrustedMintSourceRegistry trustedRegistry,
        TrustedSourceClassifier trustedSourceClassifier,
        ResearchContentNormalizer contentNormalizer,
        SolanaMintEvidenceMatcher mintMatcher,
        IOptions<TrustedIdentityProvenanceOptions> options,
        TimeProvider timeProvider,
        ILogger<TrustedIdentityProvenanceService> logger)
    {
        _candidateExtractor = candidateExtractor;
        _projectPolicyResolver = projectPolicyResolver;
        _safeSourceClient = safeSourceClient;
        _snapshotRepository = snapshotRepository;
        _trustedRegistry = trustedRegistry;
        _trustedSourceClassifier = trustedSourceClassifier;
        _contentNormalizer = contentNormalizer;
        _mintMatcher = mintMatcher;
        _options = options.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<TrustedIdentityProvenance> AnalyzeAsync(
        TrustedIdentityProvenanceRequest request,
        CancellationToken cancellationToken)
    {
        if (!SolanaPublicKeyValidator.TryNormalize(request.ScannedMint, out var normalizedScannedMint))
        {
            return CreateUnavailable(
                request.AnalyzedAtUtc,
                TrustedIdentityProvenanceUnknown.NoIdentitySourceAvailable,
                TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable,
                TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified);
        }

        var relevantMints = BuildRelevantMints(normalizedScannedMint, request.Collisions, _options.MaxCompetingMints);
        var relevantMintSetFingerprint = CreateRelevantMintSetFingerprint(relevantMints);
        var resolvedProjectPolicy = _projectPolicyResolver.Resolve(request.ScannedMint, request.ScannedMetadataUri);

        var candidates = _candidateExtractor.Extract(
            normalizedScannedMint,
            request.ScannedMetadataUri,
            _options.MaxSources,
            resolvedProjectPolicy);

        if (candidates.Count == 0)
        {
            return CreateUnavailable(
                request.AnalyzedAtUtc,
                TrustedIdentityProvenanceUnknown.NoIdentitySourceAvailable,
                TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable,
                TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified);
        }

        _trustedRegistry.TryGetByMint(normalizedScannedMint, out var registryEntry);

        var nowUtc = _timeProvider.GetUtcNow();
        var sources = new List<IdentitySourceEvidence>(candidates.Count);
        var evidence = new List<TokenIdentityProvenanceEvidence>();
        var conflicts = new List<TokenIdentityProvenanceEvidence>();
        var fetchFailures = 0;
        var trustedSourceCount = 0;
        var trustedScannedLinkCount = 0;

        foreach (var candidate in candidates)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var canonicalUrl = TryCanonicalizeForCache(candidate.Url, out var canonical)
                ? canonical
                : candidate.Url.Trim();

            CachedTokenIdentitySourceVerificationSnapshot? cached = null;
            try
            {
                cached = await _snapshotRepository.GetFreshAsync(
                    canonicalUrl,
                    relevantMintSetFingerprint,
                    TokenIdentitySourceVerificationVersion.Current,
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
                    "Trusted identity cache read failed for source {SourceUrl}. Returning safe unavailable identity provenance to prevent uncontrolled fetch fallback.",
                    candidate.Url);

                return CreateUnavailable(
                    request.AnalyzedAtUtc,
                    TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable,
                    TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified,
                    TrustedIdentityProvenanceUnknown.SourceFetchPartial);
            }

            var evaluated = cached is not null
                ? new SourceEvaluation(cached.SourceEvidence, cached.Evidence, cached.Conflicts, cached.Unknowns)
                : await EvaluateSourceAsync(
                    candidate,
                    normalizedScannedMint,
                    relevantMints,
                    registryEntry,
                    resolvedProjectPolicy,
                    cancellationToken);

            sources.Add(evaluated.Source);
            AppendBoundedEvidence(evidence, evaluated.Evidence, _options.MaxEvidencePerSource);
            AppendBoundedEvidence(conflicts, evaluated.Conflicts, _options.MaxEvidencePerSource);

            if (evaluated.Source.SourceTrust == IdentitySourceTrust.Trusted)
            {
                trustedSourceCount += 1;
            }

            if (evaluated.Source.SourceTrust == IdentitySourceTrust.Trusted
                && evaluated.Source.MintLinkStatus == IdentityMintLinkStatus.ReferencesScannedMint)
            {
                trustedScannedLinkCount += 1;
            }

            if (evaluated.Source.MintLinkStatus == IdentityMintLinkStatus.FetchUnavailable)
            {
                fetchFailures += 1;
            }

            if (cached is null)
            {
                var snapshot = CreateSnapshot(
                    canonicalUrl,
                    relevantMintSetFingerprint,
                    request.AnalyzedAtUtc,
                    nowUtc,
                    evaluated);

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
                        "Trusted identity cache write failed for source {SourceUrl}. Returning current evidence without cache persistence.",
                        candidate.Url);
                }
            }
        }

        var unknowns = new List<TrustedIdentityProvenanceUnknown>();

        if (trustedSourceCount == 0)
        {
            unknowns.Add(TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable);
        }

        if (trustedScannedLinkCount == 0)
        {
            unknowns.Add(TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified);
        }

        if (fetchFailures > 0)
        {
            unknowns.Add(TrustedIdentityProvenanceUnknown.SourceFetchPartial);
        }

        if (conflicts.Count > 0)
        {
            unknowns.Add(TrustedIdentityProvenanceUnknown.IdentitySourceConflict);
        }

        return new TrustedIdentityProvenance(
            Sources: sources,
            Evidence: evidence,
            Conflicts: conflicts,
            Unknowns: unknowns,
            AnalyzedAtUtc: request.AnalyzedAtUtc);
    }

    private async Task<SourceEvaluation> EvaluateSourceAsync(
        IdentitySourceCandidate candidate,
        string normalizedScannedMint,
        IReadOnlyList<string> relevantMints,
        TrustedMintSourceRegistryEntry? registryEntry,
        TrustedProjectSourcePolicy? projectPolicy,
        CancellationToken cancellationToken)
    {
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linkedCts.CancelAfter(TimeSpan.FromSeconds(_options.SourceTimeoutSeconds));

        var source = new CandidateResearchSource(
            Id: $"identity:{GetStableId(candidate.Url)}",
            ClaimedSourceType: ResearchSourceType.ThirdParty,
            Title: "Identity source candidate",
            Publisher: candidate.Publisher,
            Url: candidate.Url,
            ClaimedCanonicalProjectWebsite: candidate.InitialTrust == IdentitySourceTrust.ClaimedProjectSource,
            PublishedAtUtc: null);

        SafeSourceFetchResult fetchResult;
        try
        {
            fetchResult = await _safeSourceClient.FetchAsync(source, linkedCts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            fetchResult = new SafeSourceFetchResult(
                Success: false,
                FinalUri: null,
                NormalizedHost: null,
                ContentType: null,
                Content: null,
                BytesRead: 0,
                Reason: ResearchSourceAssessmentReason.Timeout,
                Detail: "Source request timed out.");
        }

        if (!fetchResult.Success || fetchResult.FinalUri is null)
        {
            var sourceEvidence = new IdentitySourceEvidence(
                Url: candidate.Url,
                Publisher: candidate.Publisher,
                SourceTrust: candidate.InitialTrust,
                MintLinkStatus: IdentityMintLinkStatus.FetchUnavailable,
                ReferencedRelevantMints: Array.Empty<string>(),
                EvidenceSummary: "Source fetch unavailable for identity verification.");

            var failedEvidence = new List<TokenIdentityProvenanceEvidence>
            {
                new("SOURCE_FETCH_UNAVAILABLE", "Identity source could not be fetched with safety constraints.")
            };

            if (candidate.DiscoveredFromTokenMetadata)
            {
                failedEvidence.Insert(0, new TokenIdentityProvenanceEvidence(
                    "SOURCE_DISCOVERED_FROM_TOKEN_METADATA",
                    "Source candidate was deterministically discovered from token metadata URI."));
            }

            return new SourceEvaluation(
                sourceEvidence,
                failedEvidence,
                Array.Empty<TokenIdentityProvenanceEvidence>(),
                new[] { TrustedIdentityProvenanceUnknown.SourceFetchPartial });
        }

        var normalization = _contentNormalizer.Normalize(fetchResult.ContentType, fetchResult.Content ?? string.Empty);
        if (!normalization.Success || normalization.Text is null)
        {
            var sourceEvidence = new IdentitySourceEvidence(
                Url: fetchResult.FinalUri.ToString(),
                Publisher: candidate.Publisher,
                SourceTrust: candidate.InitialTrust,
                MintLinkStatus: IdentityMintLinkStatus.FetchUnavailable,
                ReferencedRelevantMints: Array.Empty<string>(),
                EvidenceSummary: "Source content was unavailable for identity verification.");

            return new SourceEvaluation(
                sourceEvidence,
                new[]
                {
                    new TokenIdentityProvenanceEvidence("SOURCE_FETCH_UNAVAILABLE", "Identity source content could not be normalized safely.")
                },
                Array.Empty<TokenIdentityProvenanceEvidence>(),
                new[] { TrustedIdentityProvenanceUnknown.SourceFetchPartial });
        }

        var trustDecision = _trustedSourceClassifier.Classify(registryEntry, projectPolicy, fetchResult.FinalUri, fetchResult.NormalizedHost);
        var sourceTrust = trustDecision.IsTrusted ? IdentitySourceTrust.Trusted : candidate.InitialTrust;

        var referencedRelevantMints = _mintMatcher.FindRelevantMintReferences(
            relevantMints,
            normalization.Text,
            normalization.JsonMintFieldValues,
            _options.MaxBase58CandidatesPerSource);

        var mintLinkStatus = DetermineMintLinkStatus(normalizedScannedMint, referencedRelevantMints);

        var sourceEvidenceFinal = new IdentitySourceEvidence(
            Url: fetchResult.FinalUri.ToString(),
            Publisher: candidate.Publisher,
            SourceTrust: sourceTrust,
            MintLinkStatus: mintLinkStatus,
            ReferencedRelevantMints: referencedRelevantMints,
            EvidenceSummary: BuildSummary(sourceTrust, mintLinkStatus));

        var evidence = new List<TokenIdentityProvenanceEvidence>();
        var conflicts = new List<TokenIdentityProvenanceEvidence>();

        if (candidate.DiscoveredFromTokenMetadata)
        {
            evidence.Add(new TokenIdentityProvenanceEvidence(
                "SOURCE_DISCOVERED_FROM_TOKEN_METADATA",
                "Source candidate was deterministically discovered from token metadata URI."));
        }

        if (sourceTrust == IdentitySourceTrust.Trusted)
        {
            evidence.Add(new TokenIdentityProvenanceEvidence(
                "SOURCE_MATCHES_TRUST_REGISTRY",
                "Source matched trusted registry host/path constraints for the scanned mint."));
        }

        switch (mintLinkStatus)
        {
            case IdentityMintLinkStatus.ReferencesScannedMint:
                evidence.Add(new TokenIdentityProvenanceEvidence(
                    "SOURCE_REFERENCES_SCANNED_MINT",
                    "Source references the scanned mint exactly."));
                if (sourceTrust == IdentitySourceTrust.Trusted)
                {
                    evidence.Add(new TokenIdentityProvenanceEvidence(
                        "TRUSTED_SOURCE_REFERENCES_SCANNED_MINT",
                        "Trusted source references the scanned mint exactly."));
                }
                break;
            case IdentityMintLinkStatus.ReferencesCompetingMint:
                evidence.Add(new TokenIdentityProvenanceEvidence(
                    "SOURCE_REFERENCES_COMPETING_MINT",
                    "Source references a competing relevant mint."));
                if (sourceTrust == IdentitySourceTrust.Trusted)
                {
                    var conflict = new TokenIdentityProvenanceEvidence(
                        "TRUSTED_SOURCE_REFERENCES_COMPETING_MINT",
                        "Trusted source references a competing relevant mint.");
                    evidence.Add(conflict);
                    conflicts.Add(conflict);
                }
                break;
            case IdentityMintLinkStatus.ReferencesMultipleRelevantMints:
                evidence.Add(new TokenIdentityProvenanceEvidence(
                    "SOURCE_REFERENCES_MULTIPLE_RELEVANT_MINTS",
                    "Source references multiple relevant mints."));
                if (sourceTrust == IdentitySourceTrust.Trusted)
                {
                    var conflict = new TokenIdentityProvenanceEvidence(
                        "TRUSTED_SOURCE_REFERENCES_MULTIPLE_RELEVANT_MINTS",
                        "Trusted source references multiple relevant mints, making identity association ambiguous.");
                    evidence.Add(conflict);
                    conflicts.Add(conflict);
                }
                break;
        }

        return new SourceEvaluation(sourceEvidenceFinal, evidence, conflicts, Array.Empty<TrustedIdentityProvenanceUnknown>());
    }

    private CachedTokenIdentitySourceVerificationSnapshot CreateSnapshot(
        string canonicalUrl,
        string relevantMintSetFingerprint,
        DateTimeOffset analyzedAtUtc,
        DateTimeOffset cachedAtUtc,
        SourceEvaluation evaluation)
    {
        var freshness = ResolveFreshness(evaluation.Source, evaluation.Conflicts);

        return new CachedTokenIdentitySourceVerificationSnapshot(
            Id: string.Empty,
            CanonicalUrl: canonicalUrl,
            RelevantMintSetFingerprint: relevantMintSetFingerprint,
            IdentityProvenanceVersion: TokenIdentitySourceVerificationVersion.Current,
            AnalyzedAtUtc: analyzedAtUtc,
            CachedAtUtc: cachedAtUtc,
            ExpiresAtUtc: cachedAtUtc.Add(freshness),
            SourceEvidence: evaluation.Source,
            Evidence: evaluation.Evidence,
            Conflicts: evaluation.Conflicts,
            Unknowns: evaluation.Unknowns);
    }

    private TimeSpan ResolveFreshness(
        IdentitySourceEvidence source,
        IReadOnlyList<TokenIdentityProvenanceEvidence> conflicts)
    {
        if (source.MintLinkStatus == IdentityMintLinkStatus.FetchUnavailable)
        {
            return TimeSpan.FromMinutes(_options.UnavailableFreshnessMinutes);
        }

        if (conflicts.Count > 0)
        {
            return TimeSpan.FromMinutes(_options.ConflictFreshnessMinutes);
        }

        return source.SourceTrust == IdentitySourceTrust.Trusted
            ? TimeSpan.FromHours(_options.TrustedFreshnessHours)
            : TimeSpan.FromHours(_options.ClaimedFreshnessHours);
    }

    private static string BuildSummary(IdentitySourceTrust trust, IdentityMintLinkStatus status)
    {
        return (trust, status) switch
        {
            (IdentitySourceTrust.Trusted, IdentityMintLinkStatus.ReferencesScannedMint) =>
                "A trusted project source references this exact mint.",
            (_, IdentityMintLinkStatus.ReferencesScannedMint) =>
                "A project-linked source references this mint, but source ownership has not been independently verified.",
            (IdentitySourceTrust.Trusted, IdentityMintLinkStatus.ReferencesCompetingMint) =>
                "A trusted project source references another observed mint using the same identity.",
            (IdentitySourceTrust.Trusted, IdentityMintLinkStatus.ReferencesMultipleRelevantMints) =>
                "A trusted source references multiple relevant mints. Identity association is ambiguous.",
            (_, IdentityMintLinkStatus.FetchUnavailable) =>
                "Source verification was unavailable under safety constraints.",
            _ =>
                "No relevant mint reference was found in this source."
        };
    }

    private static IdentityMintLinkStatus DetermineMintLinkStatus(
        string normalizedScannedMint,
        IReadOnlyList<string> referencedRelevantMints)
    {
        if (referencedRelevantMints.Count == 0)
        {
            return IdentityMintLinkStatus.NoRelevantMintReference;
        }

        if (referencedRelevantMints.Count > 1)
        {
            return IdentityMintLinkStatus.ReferencesMultipleRelevantMints;
        }

        return string.Equals(referencedRelevantMints[0], normalizedScannedMint, StringComparison.Ordinal)
            ? IdentityMintLinkStatus.ReferencesScannedMint
            : IdentityMintLinkStatus.ReferencesCompetingMint;
    }

    private static IReadOnlyList<string> BuildRelevantMints(
        string normalizedScannedMint,
        IReadOnlyList<TokenIdentityCollision> collisions,
        int maxCompetingMints)
    {
        var orderedCollisions = new List<TokenIdentityCollision>(collisions.Count);
        var earliest = collisions
            .OrderBy(item => item.FirstObservedAtUtc)
            .ThenBy(item => item.CandidateMint, StringComparer.Ordinal)
            .FirstOrDefault();

        orderedCollisions.AddRange(collisions);
        orderedCollisions.Sort((left, right) =>
        {
            var leftPriority = GetCollisionPriority(left, earliest);
            var rightPriority = GetCollisionPriority(right, earliest);
            var byPriority = leftPriority.CompareTo(rightPriority);
            if (byPriority != 0)
            {
                return byPriority;
            }

            var byTime = left.FirstObservedAtUtc.CompareTo(right.FirstObservedAtUtc);
            if (byTime != 0)
            {
                return byTime;
            }

            return string.Compare(left.CandidateMint, right.CandidateMint, StringComparison.Ordinal);
        });

        var relevant = new List<string> { normalizedScannedMint };
        foreach (var collision in orderedCollisions)
        {
            if (!SolanaPublicKeyValidator.TryNormalize(collision.CandidateMint, out var normalizedCandidate))
            {
                continue;
            }

            if (string.Equals(normalizedCandidate, normalizedScannedMint, StringComparison.Ordinal)
                || relevant.Contains(normalizedCandidate, StringComparer.Ordinal))
            {
                continue;
            }

            relevant.Add(normalizedCandidate);
            if (relevant.Count >= maxCompetingMints + 1)
            {
                break;
            }
        }

        return relevant;
    }

    private static int GetCollisionPriority(TokenIdentityCollision collision, TokenIdentityCollision? earliest)
    {
        if (earliest is not null
            && string.Equals(collision.CandidateMint, earliest.CandidateMint, StringComparison.Ordinal)
            && collision.FirstObservedAtUtc == earliest.FirstObservedAtUtc)
        {
            return 0;
        }

        var hasName = collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Name);
        var hasSymbol = collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Symbol);

        if (collision.MatchLevel == TokenIdentityMatchLevel.Exact && hasName && hasSymbol)
        {
            return 1;
        }

        if (collision.MatchLevel == TokenIdentityMatchLevel.Exact && hasName)
        {
            return 2;
        }

        if (collision.MatchLevel == TokenIdentityMatchLevel.Exact && hasSymbol)
        {
            return 3;
        }

        return 4;
    }

    private static string CreateRelevantMintSetFingerprint(IReadOnlyList<string> relevantMints)
    {
        var value = string.Join("|", relevantMints.OrderBy(mint => mint, StringComparer.Ordinal));
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes);
    }

    private static bool TryCanonicalizeForCache(string url, out string canonicalUrl)
    {
        canonicalUrl = string.Empty;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        string normalizedHost;
        try
        {
            normalizedHost = new IdnMapping().GetAscii(uri.Host).ToLowerInvariant();
        }
        catch (ArgumentException)
        {
            return false;
        }

        var builder = new UriBuilder(uri)
        {
            Scheme = Uri.UriSchemeHttps,
            Host = normalizedHost,
            Port = uri.Port
        };

        canonicalUrl = builder.Uri.ToString();
        return true;
    }

    private static string GetStableId(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes)[..16];
    }

    private void AppendBoundedEvidence(
        List<TokenIdentityProvenanceEvidence> target,
        IReadOnlyList<TokenIdentityProvenanceEvidence> additions,
        int maxPerSource)
    {
        var added = 0;
        foreach (var item in additions)
        {
            if (target.Count >= _options.MaxTotalEvidence)
            {
                break;
            }

            if (added >= maxPerSource)
            {
                break;
            }

            target.Add(item);
            added += 1;
        }
    }

    private static TrustedIdentityProvenance CreateUnavailable(
        DateTimeOffset analyzedAtUtc,
        params TrustedIdentityProvenanceUnknown[] unknowns)
    {
        return new TrustedIdentityProvenance(
            Sources: Array.Empty<IdentitySourceEvidence>(),
            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Unknowns: unknowns,
            AnalyzedAtUtc: analyzedAtUtc);
    }

    private sealed record SourceEvaluation(
        IdentitySourceEvidence Source,
        IReadOnlyList<TokenIdentityProvenanceEvidence> Evidence,
        IReadOnlyList<TokenIdentityProvenanceEvidence> Conflicts,
        IReadOnlyList<TrustedIdentityProvenanceUnknown> Unknowns);
}
