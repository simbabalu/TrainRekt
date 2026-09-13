using MongoDB.Driver;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

public sealed class MongoTokenInspectionCoachSnapshotRepository : IAiSafetyCoachSnapshotRepository
{
    private readonly IMongoCollection<TokenInspectionCoachSnapshotDocument> _collection;

    public MongoTokenInspectionCoachSnapshotRepository(IMongoDatabase database, MongoDbOptions options)
    {
        _collection = database.GetCollection<TokenInspectionCoachSnapshotDocument>(options.TokenInspectionCoachCollectionName);
    }

    public async Task<CachedTokenInspectionCoachSnapshot?> GetFreshAsync(
        string mint,
        string language,
        int coachVersion,
        string inputFingerprint,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        var now = DateTime.SpecifyKind(nowUtc.UtcDateTime, DateTimeKind.Utc);

        var document = await _collection
            .Find(entry => entry.Mint == mint
                && entry.Language == language
                && entry.CoachVersion == coachVersion
                && entry.InputFingerprint == inputFingerprint
                && entry.ExpiresAtUtc > now)
            .SortByDescending(entry => entry.Coach.GeneratedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task InsertAsync(CachedTokenInspectionCoachSnapshot snapshot, CancellationToken cancellationToken)
    {
        var document = TokenMongoMapper.ToDocument(snapshot);
        await _collection.InsertOneAsync(document, cancellationToken: cancellationToken);
    }
}