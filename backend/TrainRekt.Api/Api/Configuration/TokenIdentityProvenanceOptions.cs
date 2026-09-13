namespace TrainRekt.Api.Api.Configuration;

public sealed class TokenIdentityProvenanceOptions
{
    public const string SectionName = "TokenIdentityProvenance";

    public int MaxReturnedCollisions { get; set; } = 25;
}
