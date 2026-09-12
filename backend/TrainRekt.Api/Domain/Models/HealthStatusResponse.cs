namespace TrainRekt.Api.Domain.Models;

public sealed record HealthStatusResponse(
    string Status,
    string Service,
    DateTimeOffset TimestampUtc);
