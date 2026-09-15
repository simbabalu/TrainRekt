namespace TrainRekt.Api.Api.Configuration;

public sealed class TokenResearchOptions
{
    public const string SectionName = "TokenResearch";

    public decimal LargestUnknownTokenAccountThresholdPercent { get; set; } = 10m;

    public int SourceTimeoutSeconds { get; set; } = 8;

    public int MaxRedirects { get; set; } = 3;

    public int MaxResponseBytes { get; set; } = 1_048_576;

    public int[] AllowedHttpsPorts { get; set; } = [443];
}
