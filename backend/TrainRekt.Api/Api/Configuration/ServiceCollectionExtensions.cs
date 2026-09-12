using System.Net.Http.Headers;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Infrastructure.Helius;
using TrainRekt.Api.Infrastructure.Mongo;

namespace TrainRekt.Api.Api.Configuration;

public static class ServiceCollectionExtensions
{
    public const string DevelopmentCorsPolicy = "TrainRektMobileDevelopmentCors";

    public static IServiceCollection AddApiServices(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services
            .AddOptions<HeliusOptions>()
            .Bind(configuration.GetSection(HeliusOptions.SectionName))
            .PostConfigure(options =>
            {
                if (string.IsNullOrWhiteSpace(options.ApiKey))
                {
                    options.ApiKey = configuration["HELIUS_API_KEY"];
                }
            })
            .Validate(
                options => Uri.TryCreate(options.RpcBaseUrl, UriKind.Absolute, out _),
                "Helius:RpcBaseUrl must be an absolute URI.")
            .ValidateOnStart();

        services
            .AddOptions<MongoDbOptions>()
            .Bind(configuration.GetSection(MongoDbOptions.SectionName))
            .PostConfigure(options =>
            {
                if (string.IsNullOrWhiteSpace(options.ConnectionString))
                {
                    options.ConnectionString = configuration["MONGODB_CONNECTION_STRING"];
                }
            })
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.ConnectionString),
                "MongoDb:ConnectionString must be configured when MongoDb:Enabled is true.")
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.DatabaseName),
                "MongoDb:DatabaseName must be configured when MongoDb:Enabled is true.")
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.TokenCollectionName),
                "MongoDb:TokenCollectionName must be configured when MongoDb:Enabled is true.")
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.TokenInspectionCollectionName),
                "MongoDb:TokenInspectionCollectionName must be configured when MongoDb:Enabled is true.")
            .ValidateOnStart();

        services
            .AddOptions<TokenInspectionCacheOptions>()
            .Bind(configuration.GetSection(TokenInspectionCacheOptions.SectionName))
            .Validate(
                options => options.FreshnessMinutes > 0,
                "TokenInspectionCache:FreshnessMinutes must be greater than zero.")
            .ValidateOnStart();

        services.AddSingleton(TimeProvider.System);

        services.AddHttpClient<IHeliusClient, HeliusClient>((serviceProvider, client) =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<HeliusOptions>>().Value;
            client.BaseAddress = new Uri(options.RpcBaseUrl, UriKind.Absolute);
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        })
        // Query-string auth is required by Helius; suppress only this client's automatic HttpClient URL logs.
        .RemoveAllLoggers();

        services.AddCors(options =>
        {
            options.AddPolicy(DevelopmentCorsPolicy, policy =>
            {
                policy
                    .WithOrigins(
                        "http://localhost:8081",
                        "http://127.0.0.1:8081",
                        "http://localhost:19006",
                        "http://127.0.0.1:19006",
                        "http://localhost:3000",
                        "http://127.0.0.1:3000")
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        services.AddScoped<ITokenInspectionDeterministicService, TokenInspectionService>();
        services.AddScoped<ITokenMetadataResolver, TokenMetadataResolver>();
        services.AddScoped<ILargestTokenAccountAnalysisService, LargestTokenAccountAnalysisService>();
        services.AddScoped<ITokenAccountClassificationService, TokenAccountClassificationService>();
        services.AddScoped<ITokenAccountClassifier, PumpFunBondingCurveClassifier>();

        var mongoOptions = configuration.GetSection(MongoDbOptions.SectionName).Get<MongoDbOptions>() ?? new MongoDbOptions();
        if (string.IsNullOrWhiteSpace(mongoOptions.ConnectionString))
        {
            mongoOptions.ConnectionString = configuration["MONGODB_CONNECTION_STRING"];
        }

        if (mongoOptions.Enabled)
        {
            services.AddSingleton(mongoOptions);
            services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoOptions.ConnectionString));
            services.AddSingleton(serviceProvider =>
            {
                var client = serviceProvider.GetRequiredService<IMongoClient>();
                return client.GetDatabase(mongoOptions.DatabaseName);
            });
            services.AddScoped<ITokenRepository, MongoTokenRepository>();
            services.AddScoped<ITokenInspectionSnapshotRepository, MongoTokenInspectionSnapshotRepository>();
            services.AddScoped<ITokenInspectionService, CachedTokenInspectionService>();
            services.AddHostedService<MongoIndexInitializerHostedService>();
        }
        else
        {
            services.AddScoped<ITokenInspectionService, PassthroughTokenInspectionService>();
        }

        return services;
    }
}
