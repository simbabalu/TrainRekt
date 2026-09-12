namespace TrainRekt.Api.Api.Configuration;

public sealed class TokenInspectionCacheOptions
{
    public const string SectionName = "TokenInspectionCache";

    public int FreshnessMinutes { get; set; } = 5;
}
