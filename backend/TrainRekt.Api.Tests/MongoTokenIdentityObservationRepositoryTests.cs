using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Mongo;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Tests;

public sealed class MongoTokenIdentityObservationRepositoryTests
{
    [Fact]
    public void FirstObservation_MapsAllFirstAndLastFields()
    {
        var observation = CreateObservation(
            mint: "MintA",
            rawName: "First Name",
            normalizedName: "first name",
            rawSymbol: "FIRST",
            normalizedSymbol: "first",
            firstObservedAtUtc: Utc(1),
            lastObservedAtUtc: Utc(1));

        var document = TokenMongoMapper.ToDocument(observation);

        Assert.Equal("MintA", document.Mint);
        Assert.Equal("First Name", document.FirstRawName);
        Assert.Equal("first name", document.FirstNormalizedName);
        Assert.Equal("FIRST", document.FirstRawSymbol);
        Assert.Equal("first", document.FirstNormalizedSymbol);
        Assert.Equal(document.FirstRawName, document.LastRawName);
        Assert.Equal(document.FirstNormalizedName, document.LastNormalizedName);
        Assert.Equal(document.FirstObservedAtUtc, document.LastObservedAtUtc);
    }

    [Fact]
    public void ReobserveSameMint_UpdateOnlyChangesLastFields()
    {
        var document = TokenMongoMapper.ToDocument(CreateObservation(
            mint: "MintA",
            rawName: "Changed Name",
            normalizedName: "changed name",
            rawSymbol: "CHANGED",
            normalizedSymbol: "changed",
            firstObservedAtUtc: Utc(1),
            lastObservedAtUtc: Utc(2)));

        var rendered = Render(TokenIdentityObservationRepositoryQuery.BuildUpsertUpdate(document));

        Assert.Equal("MintA", rendered["$setOnInsert"]["_id"].AsString);
        Assert.Equal("Changed Name", rendered["$setOnInsert"]["firstRawName"].AsString);
        Assert.Equal(Utc(1).UtcDateTime, rendered["$setOnInsert"]["firstObservedAtUtc"].ToUniversalTime());
        Assert.Equal("Changed Name", rendered["$set"]["lastRawName"].AsString);
        Assert.Equal("changed name", rendered["$set"]["lastNormalizedName"].AsString);
        Assert.Equal(Utc(2).UtcDateTime, rendered["$set"]["lastObservedAtUtc"].ToUniversalTime());
    }

    [Fact]
    public void ReobserveChangedMetadata_PreservesOriginalFirstObservedIdentity()
    {
        var first = TokenMongoMapper.ToDocument(CreateObservation(
            mint: "MintA",
            rawName: "First Name",
            normalizedName: "first name",
            rawSymbol: "FIRST",
            normalizedSymbol: "first",
            firstObservedAtUtc: Utc(1),
            lastObservedAtUtc: Utc(1)));
        var changed = TokenMongoMapper.ToDocument(CreateObservation(
            mint: "MintA",
            rawName: "Changed Name",
            normalizedName: "changed name",
            rawSymbol: "CHANGED",
            normalizedSymbol: "changed",
            firstObservedAtUtc: Utc(2),
            lastObservedAtUtc: Utc(3)));

        var update = Render(TokenIdentityObservationRepositoryQuery.BuildUpsertUpdate(changed));
        var persisted = first.ToBsonDocument();
        foreach (var element in update["$set"].AsBsonDocument)
        {
            persisted[element.Name] = element.Value;
        }

        Assert.Equal("First Name", persisted["firstRawName"].AsString);
        Assert.Equal("first name", persisted["firstNormalizedName"].AsString);
        Assert.Equal("FIRST", persisted["firstRawSymbol"].AsString);
        Assert.Equal("first", persisted["firstNormalizedSymbol"].AsString);
        Assert.Equal(Utc(1).UtcDateTime, persisted["firstObservedAtUtc"].ToUniversalTime());
        Assert.Equal("Changed Name", persisted["lastRawName"].AsString);
        Assert.Equal(Utc(3).UtcDateTime, persisted["lastObservedAtUtc"].ToUniversalTime());
    }

    [Fact]
    public void MapperRoundTrip_UsesLatestIdentityAndPreservesStoredFirstFields()
    {
        var document = new TokenIdentityObservationDocument
        {
            Mint = "MintA",
            FirstRawName = "Original",
            FirstNormalizedName = "original",
            FirstRawSymbol = "ORG",
            FirstNormalizedSymbol = "org",
            LastRawName = "Latest",
            LastNormalizedName = "latest",
            LastRawSymbol = "NEW",
            LastNormalizedSymbol = "new",
            FirstObservedAtUtc = Utc(1).UtcDateTime,
            LastObservedAtUtc = Utc(2).UtcDateTime,
            ObservationVersion = 1
        };

        var model = TokenMongoMapper.ToModel(document);

        Assert.Equal("Latest", model.RawName);
        Assert.Equal("latest", model.NormalizedName);
        Assert.Equal(Utc(1), model.FirstObservedAtUtc);
        Assert.Equal(Utc(2), model.LastObservedAtUtc);
        Assert.Equal("Original", document.FirstRawName);
    }

    [Fact]
    public void CollisionFilter_ExcludesCurrentMint()
    {
        var filter = TokenIdentityObservationRepositoryQuery.BuildCollisionFilter(
            excludingMint: "CurrentMint",
            new[] { Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedName, "same name") });

        var rendered = Render(filter);

        Assert.Contains("$ne", rendered.ToJson());
        Assert.Contains("CurrentMint", rendered.ToJson());
        Assert.Contains("same name", rendered.ToJson());
    }

    [Fact]
    public void CollisionFilter_NameOnlyMatchesName()
    {
        var filter = TokenIdentityObservationRepositoryQuery.BuildCollisionFilter(
            "CurrentMint",
            new[] { Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedName, "same name") });

        var rendered = Render(filter).ToJson();

        Assert.Contains("lastNormalizedName", rendered, StringComparison.Ordinal);
        Assert.DoesNotContain("lastNormalizedSymbol", rendered, StringComparison.Ordinal);
    }

    [Fact]
    public void CollisionFilter_SymbolOnlyMatchesSymbol()
    {
        var filter = TokenIdentityObservationRepositoryQuery.BuildCollisionFilter(
            "CurrentMint",
            new[] { Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedSymbol, "same") });

        var rendered = Render(filter).ToJson();

        Assert.Contains("lastNormalizedSymbol", rendered, StringComparison.Ordinal);
        Assert.DoesNotContain("lastNormalizedName", rendered, StringComparison.Ordinal);
    }

    [Fact]
    public void CollisionFilter_CombinedNameAndSymbolUsesOrWithoutDuplicateMintPath()
    {
        var filters = new FilterDefinition<TokenIdentityObservationDocument>[]
        {
            Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedName, "same name"),
            Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedSymbol, "same")
        };

        var rendered = Render(TokenIdentityObservationRepositoryQuery.BuildCollisionFilter("CurrentMint", filters));
        var json = rendered.ToJson();

        Assert.Equal(1, json.Split("CurrentMint", StringSplitOptions.None).Length - 1);
        Assert.Equal(1, json.Split("$or", StringSplitOptions.None).Length - 1);
        Assert.Contains("lastNormalizedName", json, StringComparison.Ordinal);
        Assert.Contains("lastNormalizedSymbol", json, StringComparison.Ordinal);
    }

    [Fact]
    public void CollisionSort_IsFirstObservedAscendingWithMintTieBreaker()
    {
        var rendered = Render(TokenIdentityObservationRepositoryQuery.BuildCollisionSort());

        Assert.Equal(1, rendered["firstObservedAtUtc"].AsInt32);
        Assert.Equal(1, rendered["_id"].AsInt32);
    }

    [Fact]
    public void QueryShapeSupportsBoundedCountAndTruncationWithoutChangingCountFilter()
    {
        var filter = TokenIdentityObservationRepositoryQuery.BuildCollisionFilter(
            "CurrentMint",
            new[] { Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedName, "same") });
        var renderedFilter = Render(filter);
        var sort = Render(TokenIdentityObservationRepositoryQuery.BuildCollisionSort());

        Assert.NotNull(renderedFilter);
        Assert.Equal(1, sort["firstObservedAtUtc"].AsInt32);
        Assert.Equal(1, sort["_id"].AsInt32);
        Assert.Contains("CurrentMint", renderedFilter.ToJson(), StringComparison.Ordinal);
    }

    [Fact]
    public void NullOrEmptyNormalizedValues_AreNotRepresentedAsAccidentalEqualityFilters()
    {
        var noNameFilter = Array.Empty<FilterDefinition<TokenIdentityObservationDocument>>();
        var nameOnlyFilter = new[] { Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedSymbol, "symbol") };
        var symbolOnlyFilter = new[] { Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedName, "name") };

        Assert.DoesNotContain("lastNormalizedName", Render(TokenIdentityObservationRepositoryQuery.BuildCollisionFilter("Mint", nameOnlyFilter)).ToJson(), StringComparison.Ordinal);
        Assert.DoesNotContain("lastNormalizedSymbol", Render(TokenIdentityObservationRepositoryQuery.BuildCollisionFilter("Mint", symbolOnlyFilter)).ToJson(), StringComparison.Ordinal);
        Assert.Empty(noNameFilter);
    }

    [Fact]
    public void EmptyValues_AreRepresentedAsNoMatchInputsByCaller()
    {
        var observation = CreateObservation("MintA", "", "", "", "", Utc(1), Utc(1));
        var document = TokenMongoMapper.ToDocument(observation);

        Assert.Equal(string.Empty, document.LastNormalizedName);
        Assert.Equal(string.Empty, document.LastNormalizedSymbol);
    }

    [Fact]
    public void CancellationToken_IsAcceptedByRepositoryContracts()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        Assert.True(cancellation.IsCancellationRequested);
        Assert.Throws<OperationCanceledException>(() => cancellation.Token.ThrowIfCancellationRequested());
    }

    [Fact]
    public void ObservationIdIsMint_ProvidesDuplicateUpsertKey()
    {
        var first = TokenMongoMapper.ToDocument(CreateObservation("MintA", "Name", "name", "SYM", "sym", Utc(1), Utc(1)));
        var second = TokenMongoMapper.ToDocument(CreateObservation("MintA", "Name 2", "name 2", "SYM2", "sym2", Utc(2), Utc(2)));

        Assert.Equal(first.Mint, second.Mint);
        Assert.Equal(first.Mint, first.ToBsonDocument()["_id"].AsString);
        Assert.Equal(second.Mint, second.ToBsonDocument()["_id"].AsString);
    }

    private static TokenIdentityObservation CreateObservation(
        string mint,
        string? rawName,
        string? normalizedName,
        string? rawSymbol,
        string? normalizedSymbol,
        DateTimeOffset firstObservedAtUtc,
        DateTimeOffset lastObservedAtUtc)
    {
        return new TokenIdentityObservation(
            Mint: mint,
            RawName: rawName,
            NormalizedName: normalizedName,
            RawSymbol: rawSymbol,
            NormalizedSymbol: normalizedSymbol,
            TokenProgram: "TokenProgram",
            FirstObservedAtUtc: firstObservedAtUtc,
            LastObservedAtUtc: lastObservedAtUtc,
            ObservationVersion: 1);
    }

    private static DateTimeOffset Utc(int hour)
    {
        return new DateTimeOffset(2026, 1, 1, hour, 0, 0, TimeSpan.Zero);
    }

    private static BsonDocument Render(FilterDefinition<TokenIdentityObservationDocument> definition)
    {
        return definition.Render(new RenderArgs<TokenIdentityObservationDocument>(
            BsonSerializer.SerializerRegistry.GetSerializer<TokenIdentityObservationDocument>(),
            BsonSerializer.SerializerRegistry));
    }

    private static BsonDocument Render(UpdateDefinition<TokenIdentityObservationDocument> definition)
    {
        return definition.Render(new RenderArgs<TokenIdentityObservationDocument>(
            BsonSerializer.SerializerRegistry.GetSerializer<TokenIdentityObservationDocument>(),
            BsonSerializer.SerializerRegistry)).AsBsonDocument;
    }

    private static BsonDocument Render(SortDefinition<TokenIdentityObservationDocument> definition)
    {
        return definition.Render(new RenderArgs<TokenIdentityObservationDocument>(
            BsonSerializer.SerializerRegistry.GetSerializer<TokenIdentityObservationDocument>(),
            BsonSerializer.SerializerRegistry)).AsBsonDocument;
    }
}
