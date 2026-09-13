namespace TrainRekt.Api.Infrastructure.Gemini;

public enum GeminiFailureReason
{
    Disabled,
    MissingApiKey,
    Timeout,
    RateLimited,
    ProviderUnavailable,
    ProviderRejected,
    MalformedResponse,
    SchemaViolation,
    GroundingUnavailable,
    NoUsefulSources
}
