using MongoDB.Driver;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

public sealed class MongoTokenInspectionSnapshotRepository : ITokenInspectionSnapshotRepository
{
    private readonly IMongoCollection<TokenInspectionSnapshotDocument> _collection;

    public MongoTokenInspectionSnapshotRepository(IMongoDatabase database, MongoDbOptions options)
    {
        _collection = database.GetCollection<TokenInspectionSnapshotDocument>(options.TokenInspectionCollectionName);
    }

    public async Task<CachedTokenInspectionSnapshot?> GetLatestFreshAsync(
        string mint,
        int analysisVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        var now = DateTime.SpecifyKind(nowUtc.UtcDateTime, DateTimeKind.Utc);

        var document = await _collection
            .Find(entry => entry.Mint == mint
                && entry.AnalysisVersion == analysisVersion
                && entry.ExpiresAtUtc > now)
            .SortByDescending(entry => entry.InspectedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task<CachedTokenInspectionSnapshot?> GetLatestByMintAsync(
        string mint,
        CancellationToken cancellationToken)
    {
        var document = await _collection
            .Find(entry => entry.Mint == mint)
            .SortByDescending(entry => entry.InspectedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task InsertAsync(CachedTokenInspectionSnapshot snapshot, CancellationToken cancellationToken)
    {
        var document = TokenMongoMapper.ToDocument(snapshot);
        await _collection.InsertOneAsync(document, cancellationToken: cancellationToken);
    }
}
