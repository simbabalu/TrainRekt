namespace TrainRekt.Api.Domain.Constants;

public static class TokenInspectionThresholds
{
    public const decimal HighTopHolderConcentrationPercent = 50m;
    public static readonly TimeSpan VeryNewTokenThreshold = TimeSpan.FromHours(24);
}
