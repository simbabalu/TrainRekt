using MongoDB.Driver;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

public sealed class MongoTokenResearchRepository : ITokenResearchRepository
{
    private readonly IMongoCollection<TokenResearchSnapshotDocument> _collection;

    public MongoTokenResearchRepository(IMongoDatabase database, MongoDbOptions options)
    {
        _collection = database.GetCollection<TokenResearchSnapshotDocument>(options.TokenResearchCollectionName);
    }

    public async Task<CachedTokenResearchSnapshot?> GetLatestFreshAsync(
        string mint,
        int researchVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        var now = DateTime.SpecifyKind(nowUtc.UtcDateTime, DateTimeKind.Utc);

        var document = await _collection
            .Find(entry => entry.Mint == mint
                && entry.ResearchVersion == researchVersion
                && entry.ExpiresAtUtc > now)
            .SortByDescending(entry => entry.ResearchedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task<CachedTokenResearchSnapshot?> GetLatestByMintAsync(string mint, CancellationToken cancellationToken)
    {
        var document = await _collection
            .Find(entry => entry.Mint == mint)
            .SortByDescending(entry => entry.ResearchedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task InsertAsync(CachedTokenResearchSnapshot snapshot, CancellationToken cancellationToken)
    {
        var document = TokenMongoMapper.ToDocument(snapshot);
        await _collection.InsertOneAsync(document, cancellationToken: cancellationToken);
    }
}
