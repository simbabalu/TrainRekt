using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace TrainRekt.Api.Infrastructure.Mongo.Documents;

public sealed class TokenIdentityObservationDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Mint { get; set; } = string.Empty;

    [BsonElement("firstRawName")]
    [BsonIgnoreIfNull]
    public string? FirstRawName { get; set; }

    [BsonElement("firstNormalizedName")]
    [BsonIgnoreIfNull]
    public string? FirstNormalizedName { get; set; }

    [BsonElement("firstRawSymbol")]
    [BsonIgnoreIfNull]
    public string? FirstRawSymbol { get; set; }

    [BsonElement("firstNormalizedSymbol")]
    [BsonIgnoreIfNull]
    public string? FirstNormalizedSymbol { get; set; }

    [BsonElement("lastRawName")]
    [BsonIgnoreIfNull]
    public string? LastRawName { get; set; }

    [BsonElement("lastNormalizedName")]
    [BsonIgnoreIfNull]
    public string? LastNormalizedName { get; set; }

    [BsonElement("lastRawSymbol")]
    [BsonIgnoreIfNull]
    public string? LastRawSymbol { get; set; }

    [BsonElement("lastNormalizedSymbol")]
    [BsonIgnoreIfNull]
    public string? LastNormalizedSymbol { get; set; }

    [BsonElement("tokenProgram")]
    [BsonIgnoreIfNull]
    public string? TokenProgram { get; set; }

    [BsonElement("firstObservedAtUtc")]
    public DateTime FirstObservedAtUtc { get; set; }

    [BsonElement("lastObservedAtUtc")]
    public DateTime LastObservedAtUtc { get; set; }

    [BsonElement("observationVersion")]
    public int ObservationVersion { get; set; }
}
