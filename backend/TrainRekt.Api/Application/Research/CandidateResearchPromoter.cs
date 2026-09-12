using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public sealed record CandidatePromotionResult(
    bool IsValid,
    bool HasUsableContent,
    int SourcesAccepted,
    int ClaimsAccepted,
    int ClaimsRejected,
    ProtocolResearchContext? Context);

public sealed class CandidateResearchPromoter
{
    private static readonly HashSet<string> SupportedObservedFactIds =
    [
        ObservedFactIds.MintAuthorityActive,
        ObservedFactIds.MintAuthorityAddress,
        ObservedFactIds.FreezeAuthorityActive,
        ObservedFactIds.FreezeAuthorityAddress,
        ObservedFactIds.MintSupplyRaw,
        ObservedFactIds.LargestUnknownTokenAccountPercentage,
        ObservedFactIds.TokenAccountStakingVault,
        ObservedFactIds.ProgramStakingProgram
    ];

    private readonly TokenResearchOptions _options;

    public CandidateResearchPromoter(TokenResearchOptions options)
    {
        _options = options;
    }

    public CandidatePromotionResult Promote(
        ResearchRequest request,
        CandidateResearchResult candidate,
        ResearchTrustAssessment trustAssessment)
    {
        if (candidate.Sources.Count > _options.MaxSources || candidate.Claims.Count > _options.MaxClaims)
        {
            return new CandidatePromotionResult(false, false, 0, 0, candidate.Claims.Count, null);
        }

        var candidateSourcesById = new Dictionary<string, CandidateResearchSource>(StringComparer.Ordinal);
        foreach (var source in candidate.Sources)
        {
            if (string.IsNullOrWhiteSpace(source.Id)
                || string.IsNullOrWhiteSpace(source.Title)
                || string.IsNullOrWhiteSpace(source.Publisher)
                || string.IsNullOrWhiteSpace(source.Url)
                || source.Url.Length > _options.MaxUrlLength
                || source.Title.Length > _options.MaxTitleLength
                || source.Publisher.Length > _options.MaxPublisherLength
                || !IsHttpsUrl(source.Url))
            {
                return new CandidatePromotionResult(false, false, 0, 0, candidate.Claims.Count, null);
            }

            if (!candidateSourcesById.TryAdd(source.Id, source))
            {
                return new CandidatePromotionResult(false, false, 0, 0, candidate.Claims.Count, null);
            }
        }

        var assessedSourcesById = trustAssessment.Sources
            .GroupBy(assessment => assessment.CandidateSourceId, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);

        var acceptedSources = candidate.Sources
            .Where(source => assessedSourcesById.ContainsKey(source.Id))
            .OrderBy(source => source.Id, StringComparer.Ordinal)
            .Select(source => (source, assessment: assessedSourcesById[source.Id]))
            .Where(pair =>
                pair.assessment.Decision == ResearchSourceAssessmentDecision.Accepted
                && pair.assessment.EffectiveSourceType is not null
                && (pair.assessment.EffectiveSourceType != ResearchSourceType.ProjectWebsite || pair.assessment.IsCanonicalProjectWebsite))
            .Select(pair => new ResearchSource(
                Id: pair.source.Id,
                SourceType: pair.assessment.EffectiveSourceType!.Value,
                Title: pair.source.Title,
                Publisher: pair.source.Publisher,
                Url: pair.source.Url,
                RetrievedAtUtc: null,
                PublishedAtUtc: pair.source.PublishedAtUtc))
            .ToArray();

        var acceptedSourceIds = acceptedSources
            .Select(source => source.Id)
            .ToHashSet(StringComparer.Ordinal);

        var identityAllowsPromotion = trustAssessment.Identity.Match == ResearchIdentityMatch.Confirmed
            && trustAssessment.Identity.HasExactMintMatch;
        var claimIds = new HashSet<string>(StringComparer.Ordinal);
        var promotedClaims = new List<DocumentedClaim>();
        var claimsRejected = 0;

        foreach (var claim in candidate.Claims)
        {
            if (string.IsNullOrWhiteSpace(claim.Id) || !claimIds.Add(claim.Id))
            {
                return new CandidatePromotionResult(false, false, acceptedSources.Length, promotedClaims.Count, candidate.Claims.Count, null);
            }

            if (claim.Statement.Length > _options.MaxStatementLength)
            {
                claimsRejected++;
                continue;
            }

            if (!claim.SourceIds.All(candidateSourcesById.ContainsKey))
            {
                claimsRejected++;
                continue;
            }

            var trustedClaimSourceIds = claim.SourceIds
                .Where(acceptedSourceIds.Contains)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(id => id, StringComparer.Ordinal)
                .ToArray();

            if (!identityAllowsPromotion || trustedClaimSourceIds.Length == 0)
            {
                claimsRejected++;
                continue;
            }

            var factReferences = claim.ObservedFactReferences
                .Where(reference => SupportedObservedFactIds.Contains(reference.FactId))
                .ToArray();

            promotedClaims.Add(new DocumentedClaim(
                Id: claim.Id,
                Category: claim.Category,
                Statement: claim.Statement,
                VerificationStatus: ResearchClaimVerificationStatus.Documented,
                VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                SourceIds: trustedClaimSourceIds,
                ObservedFactReferences: factReferences,
                VerificationNote: claim.ExtractionNote,
                Consistency: ObservedConsistency.Unknown));
        }

        if (acceptedSources.Length == 0 || promotedClaims.Count == 0)
        {
            return new CandidatePromotionResult(
                IsValid: true,
                HasUsableContent: false,
                SourcesAccepted: acceptedSources.Length,
                ClaimsAccepted: promotedClaims.Count,
                ClaimsRejected: claimsRejected,
                Context: null);
        }

        var protocol = request.ClassifiedProtocols.FirstOrDefault() ?? "external-research";

        return new CandidatePromotionResult(
            IsValid: true,
            HasUsableContent: true,
            SourcesAccepted: acceptedSources.Length,
            ClaimsAccepted: promotedClaims.Count,
            ClaimsRejected: claimsRejected,
            Context: new ProtocolResearchContext(protocol, acceptedSources, promotedClaims));
    }

    private static bool IsHttpsUrl(string url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
    }
}
