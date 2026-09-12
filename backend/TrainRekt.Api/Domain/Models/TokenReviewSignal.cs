namespace TrainRekt.Api.Domain.Models;

public sealed record TokenReviewSignal(
    string Id,
    string Category,
    string Severity,
    string Explanation,
    IReadOnlyDictionary<string, string> Evidence);
