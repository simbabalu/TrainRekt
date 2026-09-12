using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace TrainRekt.Api.Infrastructure.Mongo.Documents;

public sealed class TokenDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("mint")]
    public string Mint { get; set; } = string.Empty;

    [BsonElement("name")]
    [BsonIgnoreIfNull]
    public string? Name { get; set; }

    [BsonElement("symbol")]
    [BsonIgnoreIfNull]
    public string? Symbol { get; set; }

    [BsonElement("programId")]
    public string ProgramId { get; set; } = string.Empty;

    [BsonElement("firstSeenAtUtc")]
    public DateTime FirstSeenAtUtc { get; set; }

    [BsonElement("lastSeenAtUtc")]
    public DateTime LastSeenAtUtc { get; set; }
}
