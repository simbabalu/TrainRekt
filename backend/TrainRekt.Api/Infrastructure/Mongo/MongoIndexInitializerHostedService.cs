using Microsoft.Extensions.Options;
using MongoDB.Driver;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

public sealed class MongoIndexInitializerHostedService : IHostedService
{
    private readonly IMongoDatabase _database;
    private readonly MongoDbOptions _options;

    public MongoIndexInitializerHostedService(IMongoDatabase database, IOptions<MongoDbOptions> options)
    {
        _database = database;
        _options = options.Value;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var tokenCollection = _database.GetCollection<TokenDocument>(_options.TokenCollectionName);
        var tokenIndexes = new[]
        {
            new CreateIndexModel<TokenDocument>(
                Builders<TokenDocument>.IndexKeys.Ascending(entry => entry.Mint),
                new CreateIndexOptions { Unique = true, Name = "ux_tokens_mint" })
        };
        await tokenCollection.Indexes.CreateManyAsync(tokenIndexes, cancellationToken);

        var snapshotCollection = _database.GetCollection<TokenInspectionSnapshotDocument>(_options.TokenInspectionCollectionName);
        var snapshotIndexes = new[]
        {
            new CreateIndexModel<TokenInspectionSnapshotDocument>(
                Builders<TokenInspectionSnapshotDocument>.IndexKeys.Ascending(entry => entry.Mint),
                new CreateIndexOptions { Name = "ix_tokenInspections_mint" }),
            new CreateIndexModel<TokenInspectionSnapshotDocument>(
                Builders<TokenInspectionSnapshotDocument>.IndexKeys
                    .Ascending(entry => entry.Mint)
                    .Ascending(entry => entry.AnalysisVersion)
                    .Descending(entry => entry.ExpiresAtUtc)
                    .Descending(entry => entry.InspectedAtUtc),
                new CreateIndexOptions { Name = "ix_tokenInspections_cache_lookup" })
        };

        await snapshotCollection.Indexes.CreateManyAsync(snapshotIndexes, cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
