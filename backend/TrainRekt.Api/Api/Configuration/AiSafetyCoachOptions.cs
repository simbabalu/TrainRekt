namespace TrainRekt.Api.Api.Configuration;

public sealed class AiSafetyCoachOptions
{
    public const string SectionName = "AiSafetyCoach";

    public bool Enabled { get; set; }

    public string Language { get; set; } = "en";

    public int FreshnessHours { get; set; } = 24;

    public int MaxOutputTokens { get; set; } = 700;

    public int MaxSummaryLength { get; set; } = 360;

    public int MaxListItemLength { get; set; } = 220;

    public int MaxRiskExplanations { get; set; } = 4;

    public int MaxWhatToCheckNext { get; set; } = 4;

    public int MaxUncertaintyItems { get; set; } = 4;

    public int MaxReviewSignals { get; set; } = 12;

    public int MaxEvidencePerSignal { get; set; } = 6;

    public int MaxClaimSummaries { get; set; } = 12;

    public int MaxProtocolBreakdownItems { get; set; } = 12;

    public int MaxSourcesPerClaim { get; set; } = 3;
}