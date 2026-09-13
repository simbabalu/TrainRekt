using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Infrastructure.Mongo.Documents;

public sealed class TokenIdentityChronologySnapshotDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("mint")]
    public string Mint { get; set; } = string.Empty;

    [BsonElement("chronologyVersion")]
    public int ChronologyVersion { get; set; }

    [BsonElement("analyzedAtUtc")]
    public DateTime AnalyzedAtUtc { get; set; }

    [BsonElement("cachedAtUtc")]
    public DateTime CachedAtUtc { get; set; }

    [BsonElement("expiresAtUtc")]
    public DateTime ExpiresAtUtc { get; set; }

    [BsonElement("evidence")]
    public OnChainChronologyEvidence Evidence { get; set; } = default!;
}
