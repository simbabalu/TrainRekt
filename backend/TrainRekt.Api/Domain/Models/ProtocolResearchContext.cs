using System.Text.Json.Serialization;

namespace TrainRekt.Api.Domain.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ResearchSourceType
{
    OfficialDocumentation,
    OfficialWhitepaper,
    OfficialIdl,
    OfficialRepository
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ResearchClaimVerificationStatus
{
    Observed,
    Documented,
    Verified,
    NotVerified,
    Conflict,
    NotVerifiable
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ResearchClaimVerificationMethod
{
    ObservationOnly,
    DocumentationOnly,
    DeterministicReconciliation
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ObservedConsistency
{
    Consistent,
    Conflict,
    Unknown
}

public sealed record ResearchSource(
    string Id,
    ResearchSourceType SourceType,
    string Title,
    string Publisher,
    string Url,
    DateTimeOffset? RetrievedAtUtc,
    DateTimeOffset? PublishedAtUtc);

public sealed record ObservedFactReference(
    string FactId,
    string? ObservedValue,
    string? ExpectedValue,
    string? Note);

public sealed record DocumentedClaim
{
    public DocumentedClaim(
        string Id,
        string Category,
        string Statement,
        ResearchClaimVerificationStatus VerificationStatus,
        ResearchClaimVerificationMethod VerificationMethod,
        IReadOnlyList<string> SourceIds,
        IReadOnlyList<ObservedFactReference> ObservedFactReferences,
        string? VerificationNote,
        ObservedConsistency Consistency = ObservedConsistency.Unknown)
    {
        var requiresDeterministicVerification = VerificationStatus == ResearchClaimVerificationStatus.Verified;
        if (requiresDeterministicVerification
            && VerificationMethod != ResearchClaimVerificationMethod.DeterministicReconciliation)
        {
            throw new ArgumentException(
                "Verified documented claims must be produced via deterministic reconciliation.",
                nameof(VerificationMethod));
        }

        this.Id = Id;
        this.Category = Category;
        this.Statement = Statement;
        this.VerificationStatus = VerificationStatus;
        this.VerificationMethod = VerificationMethod;
        this.SourceIds = SourceIds;
        this.ObservedFactReferences = ObservedFactReferences;
        this.VerificationNote = VerificationNote;
        this.Consistency = Consistency;
    }

    public string Id { get; init; }

    public string Category { get; init; }

    public string Statement { get; init; }

    public ResearchClaimVerificationStatus VerificationStatus { get; init; }

    public ResearchClaimVerificationMethod VerificationMethod { get; init; }

    public IReadOnlyList<string> SourceIds { get; init; }

    public IReadOnlyList<ObservedFactReference> ObservedFactReferences { get; init; }

    public string? VerificationNote { get; init; }

    public ObservedConsistency Consistency { get; init; }
}

public sealed record ProtocolResearchContext(
    string Protocol,
    IReadOnlyList<ResearchSource> Sources,
    IReadOnlyList<DocumentedClaim> Claims);
