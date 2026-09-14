namespace TrainRekt.Api.Application.Abstractions;

public enum TokenInspectionResearchAvailability
{
    NotAttempted,
    Complete,
    Partial,
    Unavailable
}

public enum TokenInspectionResearchFailureCategory
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

public sealed record TokenInspectionResearchStatus(
    TokenInspectionResearchAvailability Availability,
    TokenInspectionResearchFailureCategory? FailureCategory,
    string? FailureStage,
    string? Message);