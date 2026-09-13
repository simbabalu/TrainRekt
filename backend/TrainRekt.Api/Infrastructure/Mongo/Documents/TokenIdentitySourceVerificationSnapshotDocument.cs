using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Infrastructure.Mongo.Documents;

public sealed class TokenIdentitySourceVerificationSnapshotDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("canonicalUrl")]
    public string CanonicalUrl { get; set; } = string.Empty;

    [BsonElement("relevantMintSetFingerprint")]
    public string RelevantMintSetFingerprint { get; set; } = string.Empty;

    [BsonElement("identityProvenanceVersion")]
    public int IdentityProvenanceVersion { get; set; }

    [BsonElement("analyzedAtUtc")]
    public DateTime AnalyzedAtUtc { get; set; }

    [BsonElement("cachedAtUtc")]
    public DateTime CachedAtUtc { get; set; }

    [BsonElement("expiresAtUtc")]
    public DateTime ExpiresAtUtc { get; set; }

    [BsonElement("sourceEvidence")]
    public IdentitySourceEvidence SourceEvidence { get; set; } = default!;

    [BsonElement("evidence")]
    public List<TokenIdentityProvenanceEvidence> Evidence { get; set; } = new();

    [BsonElement("conflicts")]
    public List<TokenIdentityProvenanceEvidence> Conflicts { get; set; } = new();

    [BsonElement("unknowns")]
    public List<TrustedIdentityProvenanceUnknown> Unknowns { get; set; } = new();
}
