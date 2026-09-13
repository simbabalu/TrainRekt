using MongoDB.Driver;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

public sealed class MongoTokenIdentitySourceVerificationSnapshotRepository : ITokenIdentitySourceVerificationSnapshotRepository
{
    private readonly IMongoCollection<TokenIdentitySourceVerificationSnapshotDocument> _collection;

    public MongoTokenIdentitySourceVerificationSnapshotRepository(IMongoDatabase database, MongoDbOptions options)
    {
        _collection = database.GetCollection<TokenIdentitySourceVerificationSnapshotDocument>(options.TokenIdentitySourceVerificationCollectionName);
    }

    public async Task<CachedTokenIdentitySourceVerificationSnapshot?> GetFreshAsync(
        string canonicalUrl,
        string relevantMintSetFingerprint,
        int identityProvenanceVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        var now = DateTime.SpecifyKind(nowUtc.UtcDateTime, DateTimeKind.Utc);

        var document = await _collection
            .Find(entry => entry.CanonicalUrl == canonicalUrl
                && entry.RelevantMintSetFingerprint == relevantMintSetFingerprint
                && entry.IdentityProvenanceVersion == identityProvenanceVersion
                && entry.ExpiresAtUtc > now)
            .SortByDescending(entry => entry.AnalyzedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task InsertAsync(CachedTokenIdentitySourceVerificationSnapshot snapshot, CancellationToken cancellationToken)
    {
        var document = TokenMongoMapper.ToDocument(snapshot);
        await _collection.InsertOneAsync(document, cancellationToken: cancellationToken);
    }
}
