namespace TrainRekt.Api.Api.Configuration;

public sealed class TokenResearchOptions
{
    public const string SectionName = "TokenResearch";

    public int FreshnessHours { get; set; } = 24;

    public decimal LargestUnknownTokenAccountThresholdPercent { get; set; } = 10m;

    public int MaxSources { get; set; } = 16;

    public int MaxClaims { get; set; } = 32;

    public int MaxStatementLength { get; set; } = 600;

    public int MaxUrlLength { get; set; } = 2048;

    public int MaxTitleLength { get; set; } = 160;

    public int MaxPublisherLength { get; set; } = 120;

    public int ProviderTimeoutSeconds { get; set; } = 8;

    public int SourceTimeoutSeconds { get; set; } = 8;

    public int MaxRedirects { get; set; } = 3;

    public int MaxResponseBytes { get; set; } = 1_048_576;

    public int[] AllowedHttpsPorts { get; set; } = [443];

    public bool AcceptCanonicalProjectWebsite { get; set; } = true;
}
