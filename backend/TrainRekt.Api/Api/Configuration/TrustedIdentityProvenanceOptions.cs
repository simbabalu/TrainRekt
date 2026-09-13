namespace TrainRekt.Api.Api.Configuration;

public sealed class TrustedIdentityProvenanceOptions
{
    public const string SectionName = "TrustedIdentityProvenance";

    public int MaxSources { get; set; } = 6;

    public int MaxCompetingMints { get; set; } = 5;

    public int MaxEvidencePerSource { get; set; } = 8;

    public int MaxTotalEvidence { get; set; } = 24;

    public int SourceTimeoutSeconds { get; set; } = 8;

    public int TrustedFreshnessHours { get; set; } = 24;

    public int ClaimedFreshnessHours { get; set; } = 6;

    public int UnavailableFreshnessMinutes { get; set; } = 10;

    public int ConflictFreshnessMinutes { get; set; } = 60;

    public int MaxBase58CandidatesPerSource { get; set; } = 256;
}
