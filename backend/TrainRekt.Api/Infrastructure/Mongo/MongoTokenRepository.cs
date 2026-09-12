using MongoDB.Driver;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

public sealed class MongoTokenRepository : ITokenRepository
{
    private readonly IMongoCollection<TokenDocument> _collection;

    public MongoTokenRepository(IMongoDatabase database, MongoDbOptions options)
    {
        _collection = database.GetCollection<TokenDocument>(options.TokenCollectionName);
    }

    public async Task<CachedToken?> GetByMintAsync(string mint, CancellationToken cancellationToken)
    {
        var document = await _collection
            .Find(entry => entry.Mint == mint)
            .FirstOrDefaultAsync(cancellationToken);

        return document is null ? null : TokenMongoMapper.ToModel(document);
    }

    public async Task UpsertAsync(CachedToken token, CancellationToken cancellationToken)
    {
        var document = TokenMongoMapper.ToDocument(token);
        var update = Builders<TokenDocument>.Update
            .Set(entry => entry.Name, document.Name)
            .Set(entry => entry.Symbol, document.Symbol)
            .Set(entry => entry.ProgramId, document.ProgramId)
            .Set(entry => entry.LastSeenAtUtc, document.LastSeenAtUtc)
            .SetOnInsert(entry => entry.FirstSeenAtUtc, document.FirstSeenAtUtc)
            .SetOnInsert(entry => entry.Mint, document.Mint);

        await _collection.UpdateOneAsync(
            entry => entry.Mint == token.Mint,
            update,
            new UpdateOptions { IsUpsert = true },
            cancellationToken);
    }
}
