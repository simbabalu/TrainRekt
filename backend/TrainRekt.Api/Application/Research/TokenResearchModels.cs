using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public enum ResearchNeedCategory
{
    ActiveMintAuthorityWithoutContext,
    ActiveFreezeAuthorityWithoutContext,
    LargeUnclassifiedTokenAccount
}

public enum ResearchNeedPriority
{
    Low,
    Medium,
    High
}

public sealed record ResearchNeed(
    string Id,
    ResearchNeedCategory Category,
    ResearchNeedPriority Priority,
    IReadOnlyList<ObservedFactReference> ObservedFactReferences,
    string Reason);

public sealed record ResearchRequest(
    string Mint,
    string? TokenName,
    string? TokenSymbol,
    string TokenProgram,
    TokenAuthorities Authorities,
    IReadOnlyList<string> ClassifiedProtocols,
    IReadOnlyList<ResearchNeed> Needs,
    IReadOnlyList<string> ExistingSourceIds,
    IReadOnlyList<string> ExistingClaimIds);

public enum ResearchIdentityMatch
{
    Confirmed,
    Partial,
    Unconfirmed,
    Conflict
}

public enum ResearchIdentityEvidenceType
{
    MintAddressMentioned,
    RepositoryConfigurationMentionsMint,
    IdlMentionsMint,
    CanonicalPageMentionsMint,
    DeterministicProtocolRelationship,
    SymbolOrNameMatch
}

public sealed record CandidateIdentityEvidence(
    ResearchIdentityEvidenceType EvidenceType,
    string? Value,
    string? Note);

public sealed record CandidateResearchSource(
    string Id,
    ResearchSourceType ClaimedSourceType,
    string Title,
    string Publisher,
    string Url,
    bool ClaimedCanonicalProjectWebsite,
    DateTimeOffset? PublishedAtUtc);

public sealed record CandidateDocumentedClaim(
    string Id,
    string Category,
    string Statement,
    IReadOnlyList<string> SourceIds,
    IReadOnlyList<ObservedFactReference> ObservedFactReferences,
    string? ExtractionNote);

public sealed record CandidateResearchResult(
    IReadOnlyList<CandidateIdentityEvidence> IdentityEvidence,
    IReadOnlyList<CandidateResearchSource> Sources,
    IReadOnlyList<CandidateDocumentedClaim> Claims);

public enum ResearchSourceAssessmentReason
{
    None,
    InvalidUrl,
    UnsupportedScheme,
    UnsupportedPort,
    UrlContainsCredentials,
    PrivateNetworkTarget,
    DnsResolutionRejected,
    RedirectRejected,
    TooManyRedirects,
    Timeout,
    HttpNotSuccessful,
    ResponseTooLarge,
    UnsupportedContentType,
    MalformedContent,
    MintNotReferenced,
    SourceIdentityUnconfirmed,
    CanonicalDomainUnconfirmed,
    RepositoryUnconfirmed,
    ConflictingMint
}

public enum ResearchSourceAssessmentDecision
{
    Accepted,
    Rejected
}

public sealed record AssessedResearchSource(
    string CandidateSourceId,
    ResearchSourceAssessmentDecision Decision,
    ResearchSourceType? EffectiveSourceType,
    bool IsCanonicalProjectWebsite,
    string? AssessmentNote,
    ResearchSourceAssessmentReason Reason = ResearchSourceAssessmentReason.None,
    bool HasExactMintMatch = false,
    string? NormalizedHost = null);

public sealed record ResearchIdentityAssessment(
    ResearchIdentityMatch Match,
    bool HasExactMintMatch,
    IReadOnlyList<string> EvidenceNotes);

public sealed record ResearchTrustAssessment(
    ResearchIdentityAssessment Identity,
    IReadOnlyList<AssessedResearchSource> Sources);

public enum ResearchOutcomeStatus
{
    NotRequired,
    ResearchRequired,
    Completed,
    NoUsableSources,
    InvalidCandidateData,
    Failed
}

public sealed record ResearchOutcome(
    ResearchOutcomeStatus Status,
    IReadOnlyList<ResearchNeed> Needs,
    int SourcesAccepted,
    int ClaimsAccepted,
    int ClaimsRejected,
    ProtocolResearchContext? Context,
    bool UsedCache);
