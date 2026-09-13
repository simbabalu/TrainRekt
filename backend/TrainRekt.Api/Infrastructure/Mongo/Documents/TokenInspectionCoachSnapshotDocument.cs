using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Infrastructure.Mongo.Documents;

public sealed class TokenInspectionCoachSnapshotDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("mint")]
    public string Mint { get; set; } = string.Empty;

    [BsonElement("language")]
    public string Language { get; set; } = "en";

    [BsonElement("coachVersion")]
    public int CoachVersion { get; set; }

    [BsonElement("inputFingerprint")]
    public string InputFingerprint { get; set; } = string.Empty;

    [BsonElement("cachedAtUtc")]
    public DateTime CachedAtUtc { get; set; }

    [BsonElement("expiresAtUtc")]
    public DateTime ExpiresAtUtc { get; set; }

    [BsonElement("coach")]
    public AiSafetyCoachPayload Coach { get; set; } = default!;
}