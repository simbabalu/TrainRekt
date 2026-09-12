using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Infrastructure.Mongo.Documents;

public sealed class TokenInspectionSnapshotDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("mint")]
    public string Mint { get; set; } = string.Empty;

    [BsonElement("inspectedAtUtc")]
    public DateTime InspectedAtUtc { get; set; }

    [BsonElement("cachedAtUtc")]
    public DateTime CachedAtUtc { get; set; }

    [BsonElement("analysisVersion")]
    public int AnalysisVersion { get; set; }

    [BsonElement("expiresAtUtc")]
    public DateTime ExpiresAtUtc { get; set; }

    [BsonElement("result")]
    public TokenInspection Result { get; set; } = default!;
}
