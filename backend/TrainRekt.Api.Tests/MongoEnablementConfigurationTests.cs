using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Infrastructure.Mongo;

namespace TrainRekt.Api.Tests;

public sealed class MongoEnablementConfigurationTests
{
    [Fact]
    public void AddApiServices_EnabledFalse_SelectsResearchingInspectionDecoratorOverPassthrough()
    {
        var services = new ServiceCollection();
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
            ["MongoDb:Enabled"] = "false"
        });

        services.AddApiServices(configuration);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var service = scope.ServiceProvider.GetRequiredService<ITokenInspectionService>();

        Assert.IsType<ResearchingTokenInspectionService>(service);
        Assert.NotNull(scope.ServiceProvider.GetService<PassthroughTokenInspectionService>());
        Assert.IsType<NoOpAiSafetyCoachSnapshotRepository>(scope.ServiceProvider.GetRequiredService<IAiSafetyCoachSnapshotRepository>());
        Assert.IsType<NoOpTokenIdentityObservationRepository>(scope.ServiceProvider.GetRequiredService<ITokenIdentityObservationRepository>());
        Assert.IsType<NoOpTokenIdentityChronologySnapshotRepository>(scope.ServiceProvider.GetRequiredService<ITokenIdentityChronologySnapshotRepository>());
        Assert.Null(scope.ServiceProvider.GetService<IMongoClient>());
    }

    [Fact]
    public void AddApiServices_EnabledTrueWithValidConfiguration_SelectsResearchingInspectionDecoratorOverCached()
    {
        var services = new ServiceCollection();
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
            ["MongoDb:Enabled"] = "true",
            ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
            ["MongoDb:DatabaseName"] = "trainrekt",
            ["MongoDb:TokenCollectionName"] = "tokens",
            ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections"
        });

        services.AddApiServices(configuration);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var service = scope.ServiceProvider.GetRequiredService<ITokenInspectionService>();

        Assert.IsType<ResearchingTokenInspectionService>(service);
        Assert.NotNull(scope.ServiceProvider.GetService<CachedTokenInspectionService>());
        Assert.IsType<MongoTokenInspectionCoachSnapshotRepository>(scope.ServiceProvider.GetRequiredService<IAiSafetyCoachSnapshotRepository>());
        Assert.IsType<MongoTokenIdentityObservationRepository>(scope.ServiceProvider.GetRequiredService<ITokenIdentityObservationRepository>());
        Assert.IsType<MongoTokenIdentityChronologySnapshotRepository>(scope.ServiceProvider.GetRequiredService<ITokenIdentityChronologySnapshotRepository>());
        Assert.NotNull(scope.ServiceProvider.GetService<IMongoClient>());
    }

    [Fact]
    public void AddApiServices_EnabledTrueMissingTokenIdentityChronologyCollectionName_ValidationFails()
    {
        var ex = Assert.Throws<OptionsValidationException>(() => BuildAndGetMongoOptions(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["MongoDb:Enabled"] = "true",
                ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
                ["MongoDb:DatabaseName"] = "trainrekt",
                ["MongoDb:TokenCollectionName"] = "tokens",
                ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections",
                ["MongoDb:TokenResearchCollectionName"] = "tokenResearch",
                ["MongoDb:TokenInspectionCoachCollectionName"] = "tokenInspectionCoach",
                ["MongoDb:TokenIdentityObservationCollectionName"] = "tokenIdentityObservations",
                ["MongoDb:TokenIdentityChronologyCollectionName"] = ""
            })));

        Assert.Contains("MongoDb:TokenIdentityChronologyCollectionName", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AddApiServices_EnabledTrueMissingTokenIdentityObservationCollectionName_ValidationFails()
    {
        var ex = Assert.Throws<OptionsValidationException>(() => BuildAndGetMongoOptions(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["MongoDb:Enabled"] = "true",
                ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
                ["MongoDb:DatabaseName"] = "trainrekt",
                ["MongoDb:TokenCollectionName"] = "tokens",
                ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections",
                ["MongoDb:TokenResearchCollectionName"] = "tokenResearch",
                ["MongoDb:TokenInspectionCoachCollectionName"] = "tokenInspectionCoach",
                ["MongoDb:TokenIdentityObservationCollectionName"] = ""
            })));

        Assert.Contains("MongoDb:TokenIdentityObservationCollectionName", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AddApiServices_EnabledTrueMissingTokenInspectionCoachCollectionName_ValidationFails()
    {
        var ex = Assert.Throws<OptionsValidationException>(() => BuildAndGetMongoOptions(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["MongoDb:Enabled"] = "true",
                ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
                ["MongoDb:DatabaseName"] = "trainrekt",
                ["MongoDb:TokenCollectionName"] = "tokens",
                ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections",
                ["MongoDb:TokenResearchCollectionName"] = "tokenResearch",
                ["MongoDb:TokenInspectionCoachCollectionName"] = ""
            })));

        Assert.Contains("MongoDb:TokenInspectionCoachCollectionName", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AddApiServices_EnabledTrueMissingConnectionString_ValidationFails()
    {
        var ex = Assert.Throws<OptionsValidationException>(() => BuildAndGetMongoOptions(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["MongoDb:Enabled"] = "true",
                ["MongoDb:DatabaseName"] = "trainrekt",
                ["MongoDb:TokenCollectionName"] = "tokens",
                ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections"
            })));

        Assert.Contains("MongoDb:ConnectionString", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AddApiServices_EnabledTrueMissingDatabaseName_ValidationFails()
    {
        var ex = Assert.Throws<OptionsValidationException>(() => BuildAndGetMongoOptions(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["MongoDb:Enabled"] = "true",
                ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
                ["MongoDb:DatabaseName"] = "",
                ["MongoDb:TokenCollectionName"] = "tokens",
                ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections"
            })));

        Assert.Contains("MongoDb:DatabaseName", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AddApiServices_EnabledTrueMissingTokenCollectionName_ValidationFails()
    {
        var ex = Assert.Throws<OptionsValidationException>(() => BuildAndGetMongoOptions(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["MongoDb:Enabled"] = "true",
                ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
                ["MongoDb:DatabaseName"] = "trainrekt",
                ["MongoDb:TokenCollectionName"] = "",
                ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections"
            })));

        Assert.Contains("MongoDb:TokenCollectionName", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AddApiServices_EnabledTrueMissingTokenInspectionCollectionName_ValidationFails()
    {
        var ex = Assert.Throws<OptionsValidationException>(() => BuildAndGetMongoOptions(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["MongoDb:Enabled"] = "true",
                ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
                ["MongoDb:DatabaseName"] = "trainrekt",
                ["MongoDb:TokenCollectionName"] = "tokens",
                ["MongoDb:TokenInspectionCollectionName"] = ""
            })));

        Assert.Contains("MongoDb:TokenInspectionCollectionName", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void AddApiServices_EnabledTrueNeverFallsBackToPassthrough()
    {
        var services = new ServiceCollection();
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
            ["MongoDb:Enabled"] = "true",
            ["MongoDb:ConnectionString"] = "mongodb://localhost:27017",
            ["MongoDb:DatabaseName"] = "trainrekt",
            ["MongoDb:TokenCollectionName"] = "tokens",
            ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections"
        });

        services.AddApiServices(configuration);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var service = scope.ServiceProvider.GetRequiredService<ITokenInspectionService>();

        Assert.IsNotType<PassthroughTokenInspectionService>(service);
        Assert.IsType<ResearchingTokenInspectionService>(service);
        Assert.NotNull(scope.ServiceProvider.GetService<CachedTokenInspectionService>());
    }

    [Fact]
    public void AddApiServices_ValidationErrorsDoNotExposeConnectionStringValues()
    {
        const string secretLikeConnectionString = "mongodb://user:super-secret-password@localhost:27017";

        var ex = Assert.Throws<OptionsValidationException>(() => BuildAndGetMongoOptions(
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["MongoDb:Enabled"] = "true",
                ["MongoDb:ConnectionString"] = secretLikeConnectionString,
                ["MongoDb:DatabaseName"] = "",
                ["MongoDb:TokenCollectionName"] = "tokens",
                ["MongoDb:TokenInspectionCollectionName"] = "tokenInspections"
            })));

        Assert.DoesNotContain(secretLikeConnectionString, ex.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("super-secret-password", ex.Message, StringComparison.Ordinal);
    }

    private static MongoDbOptions BuildAndGetMongoOptions(IConfiguration configuration)
    {
        var services = new ServiceCollection();
        services.AddApiServices(configuration);

        using var provider = services.BuildServiceProvider();
        return provider.GetRequiredService<IOptions<MongoDbOptions>>().Value;
    }

    private static IConfiguration BuildConfiguration(IDictionary<string, string?> values)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }
}
