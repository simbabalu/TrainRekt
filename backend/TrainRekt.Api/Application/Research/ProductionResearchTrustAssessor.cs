using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Application.Research;

public sealed class ProductionResearchTrustAssessor : IResearchTrustAssessor
{
    private readonly ISafeResearchSourceClient _safeSourceClient;
    private readonly ITrustedMintSourceRegistry _registry;
    private readonly ResearchContentNormalizer _normalizer;
    private readonly SolanaMintEvidenceMatcher _mintMatcher;
    private readonly TrustedSourceClassifier _sourceClassifier;
    private readonly ILogger<ProductionResearchTrustAssessor> _logger;

    public ProductionResearchTrustAssessor(
        ISafeResearchSourceClient safeSourceClient,
        ITrustedMintSourceRegistry registry,
        ResearchContentNormalizer normalizer,
        SolanaMintEvidenceMatcher mintMatcher,
        TrustedSourceClassifier sourceClassifier,
        ILogger<ProductionResearchTrustAssessor> logger)
    {
        _safeSourceClient = safeSourceClient;
        _registry = registry;
        _normalizer = normalizer;
        _mintMatcher = mintMatcher;
        _sourceClassifier = sourceClassifier;
        _logger = logger;
    }

    public async Task<ResearchTrustAssessment> AssessAsync(
        ResearchRequest request,
        CandidateResearchResult candidate,
        CancellationToken cancellationToken)
    {
        if (!SolanaPublicKeyValidator.TryNormalize(request.Mint, out var normalizedMint))
        {
            return new ResearchTrustAssessment(
                Identity: new ResearchIdentityAssessment(ResearchIdentityMatch.Unconfirmed, false, new[] { "Requested mint is not a valid Solana public key." }),
                Sources: candidate.Sources.Select(source =>
                    new AssessedResearchSource(source.Id, ResearchSourceAssessmentDecision.Rejected, null, false, "Invalid requested mint.", ResearchSourceAssessmentReason.InvalidUrl)).ToArray());
        }

        TrustedMintSourceRegistryEntry? registryEntry = null;
        if (_registry.TryGetByMint(normalizedMint, out var trustedEntry))
        {
            registryEntry = trustedEntry;
        }

        var assessedSources = new List<AssessedResearchSource>(candidate.Sources.Count);
        var hasTrustedConfirmedEvidence = false;
        var hasPartialEvidence = false;
        var hasConflict = false;
        var evidenceNotes = new List<string>();

        foreach (var source in candidate.Sources)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var fetchResult = await _safeSourceClient.FetchAsync(source, cancellationToken);
            if (!fetchResult.Success || fetchResult.FinalUri is null)
            {
                assessedSources.Add(new AssessedResearchSource(
                    CandidateSourceId: source.Id,
                    Decision: ResearchSourceAssessmentDecision.Rejected,
                    EffectiveSourceType: null,
                    IsCanonicalProjectWebsite: false,
                    AssessmentNote: fetchResult.Detail,
                    Reason: fetchResult.Reason,
                    HasExactMintMatch: false,
                    NormalizedHost: fetchResult.NormalizedHost));
                continue;
            }

            var normalization = _normalizer.Normalize(fetchResult.ContentType, fetchResult.Content ?? string.Empty);
            if (!normalization.Success || normalization.Text is null)
            {
                assessedSources.Add(new AssessedResearchSource(
                    CandidateSourceId: source.Id,
                    Decision: ResearchSourceAssessmentDecision.Rejected,
                    EffectiveSourceType: null,
                    IsCanonicalProjectWebsite: false,
                    AssessmentNote: "Unsupported or malformed content.",
                    Reason: normalization.Reason,
                    HasExactMintMatch: false,
                    NormalizedHost: fetchResult.NormalizedHost));
                continue;
            }

            var trustInfo = _sourceClassifier.Classify(registryEntry, fetchResult.FinalUri, fetchResult.NormalizedHost);
            var mintMatch = _mintMatcher.Match(normalizedMint, normalization.Text, normalization.JsonMintFieldValues);

            if (trustInfo.IsTrusted && mintMatch.HasConflictingMintEvidence)
            {
                hasConflict = true;
                evidenceNotes.Add($"Trusted source {source.Id} contains conflicting mint evidence.");

                assessedSources.Add(new AssessedResearchSource(
                    CandidateSourceId: source.Id,
                    Decision: ResearchSourceAssessmentDecision.Rejected,
                    EffectiveSourceType: trustInfo.EffectiveType,
                    IsCanonicalProjectWebsite: trustInfo.IsCanonicalProjectWebsite,
                    AssessmentNote: "Trusted source contains conflicting mint evidence.",
                    Reason: ResearchSourceAssessmentReason.ConflictingMint,
                    HasExactMintMatch: mintMatch.HasExactMintMatch,
                    NormalizedHost: fetchResult.NormalizedHost));
                continue;
            }

            if (trustInfo.IsTrusted && mintMatch.HasExactMintMatch)
            {
                hasTrustedConfirmedEvidence = true;
                evidenceNotes.Add($"Trusted source {source.Id} includes the exact mint address.");

                assessedSources.Add(new AssessedResearchSource(
                    CandidateSourceId: source.Id,
                    Decision: ResearchSourceAssessmentDecision.Accepted,
                    EffectiveSourceType: trustInfo.EffectiveType,
                    IsCanonicalProjectWebsite: trustInfo.IsCanonicalProjectWebsite,
                    AssessmentNote: "Trusted source with exact mint match.",
                    Reason: ResearchSourceAssessmentReason.None,
                    HasExactMintMatch: true,
                    NormalizedHost: fetchResult.NormalizedHost));
                continue;
            }

            if (mintMatch.HasExactMintMatch)
            {
                hasPartialEvidence = true;
                evidenceNotes.Add($"Source {source.Id} includes mint text but has no trusted registry relationship.");
            }

            var rejectionReason = !trustInfo.IsTrusted
                ? ResearchSourceAssessmentReason.SourceIdentityUnconfirmed
                : ResearchSourceAssessmentReason.MintNotReferenced;

            assessedSources.Add(new AssessedResearchSource(
                CandidateSourceId: source.Id,
                Decision: ResearchSourceAssessmentDecision.Rejected,
                EffectiveSourceType: trustInfo.EffectiveType,
                IsCanonicalProjectWebsite: trustInfo.IsCanonicalProjectWebsite,
                AssessmentNote: trustInfo.IsTrusted
                    ? "Trusted source did not include exact mint evidence."
                    : "Source is not trusted by registry for requested mint.",
                Reason: rejectionReason,
                HasExactMintMatch: mintMatch.HasExactMintMatch,
                NormalizedHost: fetchResult.NormalizedHost));
        }

        var identity = hasConflict
            ? new ResearchIdentityAssessment(ResearchIdentityMatch.Conflict, false, evidenceNotes)
            : hasTrustedConfirmedEvidence
                ? new ResearchIdentityAssessment(ResearchIdentityMatch.Confirmed, true, evidenceNotes)
                : hasPartialEvidence
                    ? new ResearchIdentityAssessment(ResearchIdentityMatch.Partial, false, evidenceNotes)
                    : new ResearchIdentityAssessment(ResearchIdentityMatch.Unconfirmed, false, evidenceNotes);

        _logger.LogInformation(
            "Research trust assessment completed for mint {Mint}. Confirmed={Confirmed}, Partial={Partial}, Conflict={Conflict}, Sources={SourceCount}.",
            normalizedMint,
            identity.Match == ResearchIdentityMatch.Confirmed,
            identity.Match == ResearchIdentityMatch.Partial,
            identity.Match == ResearchIdentityMatch.Conflict,
            assessedSources.Count);

        return new ResearchTrustAssessment(identity, assessedSources);
    }
}
