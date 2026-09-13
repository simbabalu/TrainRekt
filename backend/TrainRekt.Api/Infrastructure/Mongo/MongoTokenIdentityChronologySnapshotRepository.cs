using MongoDB.Driver;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

public sealed class MongoTokenIdentityChronologySnapshotRepository : ITokenIdentityChronologySnapshotRepository
{
    private readonly IMongoCollection<TokenIdentityChronologySnapshotDocument> _collection;

    public MongoTokenIdentityChronologySnapshotRepository(IMongoDatabase database, MongoDbOptions options)
    {
        _collection = database.GetCollection<TokenIdentityChronologySnapshotDocument>(options.TokenIdentityChronologyCollectionName);
    }

    public async Task<CachedTokenIdentityChronologySnapshot?> GetFreshAsync(
        string mint,
        int chronologyVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        var now = DateTime.SpecifyKind(nowUtc.UtcDateTime, DateTimeKind.Utc);

        var document = await _collection
            .Find(entry => entry.Mint == mint
                && entry.ChronologyVersion == chronologyVersion
                && entry.ExpiresAtUtc > now)
            .SortByDescending(entry => entry.AnalyzedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task InsertAsync(CachedTokenIdentityChronologySnapshot snapshot, CancellationToken cancellationToken)
    {
        var document = TokenMongoMapper.ToDocument(snapshot);
        await _collection.InsertOneAsync(document, cancellationToken: cancellationToken);
    }
}
