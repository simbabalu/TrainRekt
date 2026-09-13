namespace TrainRekt.Api.Api.Configuration;

public sealed class MongoDbOptions
{
    public const string SectionName = "MongoDb";

    public bool Enabled { get; set; }

    public string? ConnectionString { get; set; }

    public string DatabaseName { get; set; } = "trainrekt";

    public string TokenCollectionName { get; set; } = "tokens";

    public string TokenInspectionCollectionName { get; set; } = "tokenInspections";

    public string TokenResearchCollectionName { get; set; } = "tokenResearch";

    public string TokenInspectionCoachCollectionName { get; set; } = "tokenInspectionCoach";

    public string TokenIdentityObservationCollectionName { get; set; } = "tokenIdentityObservations";

    public string TokenIdentityChronologyCollectionName { get; set; } = "tokenIdentityChronology";

    public string TokenIdentitySourceVerificationCollectionName { get; set; } = "tokenIdentitySourceVerification";
}
