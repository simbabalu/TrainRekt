namespace TrainRekt.Api.Api.Configuration;

public sealed class TokenIdentityClassificationOptions
{
    public const string SectionName = "TokenIdentityClassification";

    public int MaxClassificationCompetitors { get; set; } = 1;
}
