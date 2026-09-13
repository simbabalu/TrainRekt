namespace TrainRekt.Api.Api.Configuration;

public sealed class OnChainChronologyOptions
{
    public const string SectionName = "OnChainChronology";

    public int PageSize { get; set; } = 1000;

    public int MaxPages { get; set; } = 8;

    public int MaxSignatures { get; set; } = 8000;

    public int TimeoutSeconds { get; set; } = 10;

    public int CompleteFreshnessHours { get; set; } = 168;

    public int PartialFreshnessMinutes { get; set; } = 60;

    public int FailureFreshnessMinutes { get; set; } = 10;
}
