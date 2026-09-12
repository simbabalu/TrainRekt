using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Infrastructure.Mongo.Documents;

public sealed class TokenResearchSnapshotDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("mint")]
    public string Mint { get; set; } = string.Empty;

    [BsonElement("protocol")]
    public string Protocol { get; set; } = string.Empty;

    [BsonElement("researchVersion")]
    public int ResearchVersion { get; set; }

    [BsonElement("researchedAtUtc")]
    public DateTime ResearchedAtUtc { get; set; }

    [BsonElement("cachedAtUtc")]
    public DateTime CachedAtUtc { get; set; }

    [BsonElement("expiresAtUtc")]
    public DateTime ExpiresAtUtc { get; set; }

    [BsonElement("context")]
    public ProtocolResearchContext Context { get; set; } = default!;
}
