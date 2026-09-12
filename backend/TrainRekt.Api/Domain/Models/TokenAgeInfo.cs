namespace TrainRekt.Api.Domain.Models;

public sealed record TokenAgeInfo(
    long? AgeSeconds,
    DateTimeOffset? InferredCreatedAtUtc,
    bool IsReliable,
    string? UnavailableReason);
