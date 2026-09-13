using MongoDB.Driver;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

public sealed class MongoTokenIdentityObservationRepository : ITokenIdentityObservationRepository
{
    private readonly IMongoCollection<TokenIdentityObservationDocument> _collection;

    public MongoTokenIdentityObservationRepository(IMongoDatabase database, MongoDbOptions options)
    {
        _collection = database.GetCollection<TokenIdentityObservationDocument>(options.TokenIdentityObservationCollectionName);
    }

    public async Task<TokenIdentityObservation?> GetByMintAsync(string mint, CancellationToken cancellationToken)
    {
        var document = await _collection
            .Find(entry => entry.Mint == mint)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task UpsertAsync(TokenIdentityObservation observation, CancellationToken cancellationToken)
    {
        var document = TokenMongoMapper.ToDocument(observation);
        var update = TokenIdentityObservationRepositoryQuery.BuildUpsertUpdate(document);

        await _collection.UpdateOneAsync(
            entry => entry.Mint == observation.Mint,
            update,
            new UpdateOptions { IsUpsert = true },
            cancellationToken);
    }

    public async Task<TokenIdentityObservationQueryResult> FindCollisionsAsync(
        string excludingMint,
        string? normalizedName,
        string? normalizedSymbol,
        int limit,
        CancellationToken cancellationToken)
    {
        var matchFilters = new List<FilterDefinition<TokenIdentityObservationDocument>>(2);
        if (!string.IsNullOrWhiteSpace(normalizedName))
        {
            matchFilters.Add(Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedName, normalizedName));
        }

        if (!string.IsNullOrWhiteSpace(normalizedSymbol))
        {
            matchFilters.Add(Builders<TokenIdentityObservationDocument>.Filter.Eq(entry => entry.LastNormalizedSymbol, normalizedSymbol));
        }

        if (matchFilters.Count == 0)
        {
            return new TokenIdentityObservationQueryResult(0, Array.Empty<TokenIdentityObservation>());
        }

        var filter = TokenIdentityObservationRepositoryQuery.BuildCollisionFilter(excludingMint, matchFilters);

        var totalCountLong = await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var totalCount = totalCountLong > int.MaxValue ? int.MaxValue : (int)totalCountLong;

        var documents = limit <= 0
            ? new List<TokenIdentityObservationDocument>()
            : await _collection
                .Find(filter)
                .Sort(TokenIdentityObservationRepositoryQuery.BuildCollisionSort())
                .Limit(limit)
                .ToListAsync(cancellationToken);

        return new TokenIdentityObservationQueryResult(
            TotalCount: totalCount,
            Observations: documents.Select(TokenMongoMapper.ToModel).ToArray());
    }
}

internal static class TokenIdentityObservationRepositoryQuery
{
    public static FilterDefinition<TokenIdentityObservationDocument> BuildCollisionFilter(
        string excludingMint,
        IReadOnlyList<FilterDefinition<TokenIdentityObservationDocument>> matchFilters)
    {
        return Builders<TokenIdentityObservationDocument>.Filter.And(
            Builders<TokenIdentityObservationDocument>.Filter.Ne(entry => entry.Mint, excludingMint),
            Builders<TokenIdentityObservationDocument>.Filter.Or(matchFilters));
    }

    public static UpdateDefinition<TokenIdentityObservationDocument> BuildUpsertUpdate(
        TokenIdentityObservationDocument document)
    {
        return Builders<TokenIdentityObservationDocument>.Update
            .Set(entry => entry.LastRawName, document.LastRawName)
            .Set(entry => entry.LastNormalizedName, document.LastNormalizedName)
            .Set(entry => entry.LastRawSymbol, document.LastRawSymbol)
            .Set(entry => entry.LastNormalizedSymbol, document.LastNormalizedSymbol)
            .Set(entry => entry.TokenProgram, document.TokenProgram)
            .Set(entry => entry.LastObservedAtUtc, document.LastObservedAtUtc)
            .Set(entry => entry.ObservationVersion, document.ObservationVersion)
            .SetOnInsert(entry => entry.Mint, document.Mint)
            .SetOnInsert(entry => entry.FirstRawName, document.FirstRawName)
            .SetOnInsert(entry => entry.FirstNormalizedName, document.FirstNormalizedName)
            .SetOnInsert(entry => entry.FirstRawSymbol, document.FirstRawSymbol)
            .SetOnInsert(entry => entry.FirstNormalizedSymbol, document.FirstNormalizedSymbol)
            .SetOnInsert(entry => entry.FirstObservedAtUtc, document.FirstObservedAtUtc);
    }

    public static SortDefinition<TokenIdentityObservationDocument> BuildCollisionSort()
    {
        return Builders<TokenIdentityObservationDocument>.Sort
            .Ascending(entry => entry.FirstObservedAtUtc)
            .Ascending(entry => entry.Mint);
    }
}
