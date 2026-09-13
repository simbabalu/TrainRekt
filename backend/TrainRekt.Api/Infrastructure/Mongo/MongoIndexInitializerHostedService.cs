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

        var researchCollection = _database.GetCollection<TokenResearchSnapshotDocument>(_options.TokenResearchCollectionName);
        var researchIndexes = new[]
        {
            new CreateIndexModel<TokenResearchSnapshotDocument>(
                Builders<TokenResearchSnapshotDocument>.IndexKeys.Ascending(entry => entry.Mint),
                new CreateIndexOptions { Name = "ix_tokenResearch_mint" }),
            new CreateIndexModel<TokenResearchSnapshotDocument>(
                Builders<TokenResearchSnapshotDocument>.IndexKeys
                    .Ascending(entry => entry.Mint)
                    .Ascending(entry => entry.ResearchVersion)
                    .Descending(entry => entry.ExpiresAtUtc)
                    .Descending(entry => entry.ResearchedAtUtc),
                new CreateIndexOptions { Name = "ix_tokenResearch_cache_lookup" })
        };

        await researchCollection.Indexes.CreateManyAsync(researchIndexes, cancellationToken);

        var coachCollection = _database.GetCollection<TokenInspectionCoachSnapshotDocument>(_options.TokenInspectionCoachCollectionName);
        var coachIndexes = new[]
        {
            new CreateIndexModel<TokenInspectionCoachSnapshotDocument>(
                Builders<TokenInspectionCoachSnapshotDocument>.IndexKeys.Ascending(entry => entry.Mint),
                new CreateIndexOptions { Name = "ix_tokenInspectionCoach_mint" }),
            new CreateIndexModel<TokenInspectionCoachSnapshotDocument>(
                Builders<TokenInspectionCoachSnapshotDocument>.IndexKeys
                    .Ascending(entry => entry.Mint)
                    .Ascending(entry => entry.Language)
                    .Ascending(entry => entry.CoachVersion)
                    .Ascending(entry => entry.InputFingerprint)
                    .Descending(entry => entry.ExpiresAtUtc)
                    .Descending(entry => entry.Coach.GeneratedAtUtc),
                new CreateIndexOptions { Name = "ix_tokenInspectionCoach_cache_lookup" })
        };

        await coachCollection.Indexes.CreateManyAsync(coachIndexes, cancellationToken);

        var observationCollection = _database.GetCollection<TokenIdentityObservationDocument>(_options.TokenIdentityObservationCollectionName);
        var observationIndexes = new[]
        {
            new CreateIndexModel<TokenIdentityObservationDocument>(
                Builders<TokenIdentityObservationDocument>.IndexKeys
                    .Ascending(entry => entry.LastNormalizedName)
                    .Ascending(entry => entry.FirstObservedAtUtc)
                    .Ascending(entry => entry.Mint),
                new CreateIndexOptions { Name = "ix_tokenIdentityObservations_name_lookup" }),
            new CreateIndexModel<TokenIdentityObservationDocument>(
                Builders<TokenIdentityObservationDocument>.IndexKeys
                    .Ascending(entry => entry.LastNormalizedSymbol)
                    .Ascending(entry => entry.FirstObservedAtUtc)
                    .Ascending(entry => entry.Mint),
                new CreateIndexOptions { Name = "ix_tokenIdentityObservations_symbol_lookup" })
        };

        await observationCollection.Indexes.CreateManyAsync(observationIndexes, cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
