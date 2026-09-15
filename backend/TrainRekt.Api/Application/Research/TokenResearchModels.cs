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

// Shared with the active trusted-identity source fetch path (ISafeResearchSourceClient.FetchAsync).
public sealed record CandidateResearchSource(
    string Id,
    ResearchSourceType ClaimedSourceType,
    string Title,
    string Publisher,
    string Url,
    bool ClaimedCanonicalProjectWebsite,
    DateTimeOffset? PublishedAtUtc);

// Shared with the active URL-safety/fetch infrastructure (ResearchUrlSafetyPolicy, SafeResearchSourceClient).
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

public enum ResearchOutcomeStatus
{
    NotRequired,
    ResearchRequired,
    Completed,
    NoUsableSources,
    InvalidCandidateData,
    Failed
}

public enum ResearchAvailability
{
    NotAttempted,
    Complete,
    Partial,
    Unavailable
}

public enum ResearchFailureCategory
{
    Timeout,
    Cancelled,
    ProviderUnavailable,
    NetworkFailure,
    InvalidProviderResponse,
    RateLimited,
    ProviderRejected,
    Disabled,
    MissingApiKey,
    Unknown
}

public sealed record ResearchOutcome(
    ResearchOutcomeStatus Status,
    IReadOnlyList<ResearchNeed> Needs,
    int SourcesAccepted,
    int ClaimsAccepted,
    int ClaimsRejected,
    ProtocolResearchContext? Context,
    bool UsedCache,
    ResearchAvailability Availability = ResearchAvailability.NotAttempted,
    ResearchFailureCategory? FailureCategory = null,
    string? FailureStage = null,
    string? Detail = null);
