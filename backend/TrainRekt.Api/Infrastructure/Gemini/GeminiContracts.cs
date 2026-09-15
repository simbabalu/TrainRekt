namespace TrainRekt.Api.Infrastructure.Gemini;

// Shared with GeminiAiSafetyCoach and GeminiTokenExternalContextProvider bounded response reads.
public sealed record GeminiClientResult<T>(
    bool Success,
    T? Value,
    GeminiFailureReason? FailureReason,
    string? Detail,
    int? HttpStatusCode = null);
