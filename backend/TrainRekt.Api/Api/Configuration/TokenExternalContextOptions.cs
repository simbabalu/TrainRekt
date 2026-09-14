namespace TrainRekt.Api.Api.Configuration;

public sealed class TokenExternalContextOptions
{
    public const string SectionName = "TokenExternalContext";

    public bool Enabled { get; set; } = true;

    public int FreshnessHours { get; set; } = 6;

    public int TimeoutSeconds { get; set; } = 8;

    public int MaxOutputTokens { get; set; } = 420;

    public int MaxSummaryLength { get; set; } = 220;

    public int MaxProjectNameLength { get; set; } = 80;

    public int MaxEvidenceItems { get; set; } = 3;

    public int MaxEvidenceClaimLength { get; set; } = 120;

    public int MaxEvidenceTitleLength { get; set; } = 100;

    public int MaxKnownOfficialUrls { get; set; } = 6;

    public int MaxCacheEntries { get; set; } = 256;
}
