using System.Net.Http.Headers;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Infrastructure.Gemini;
using TrainRekt.Api.Infrastructure.Helius;
using TrainRekt.Api.Infrastructure.Mongo;
using TrainRekt.Api.Infrastructure.Research;
using TrainRekt.Api.Infrastructure.Solana;

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
            .AddOptions<GeminiOptions>()
            .Bind(configuration.GetSection(GeminiOptions.SectionName))
            .PostConfigure(options =>
            {
                if (string.IsNullOrWhiteSpace(options.ApiKey))
                {
                    options.ApiKey = configuration["GEMINI_API_KEY"];
                }
            })
            .Validate(options => Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out _), "Gemini:BaseUrl must be an absolute URI.")
            .Validate(options => !string.IsNullOrWhiteSpace(options.Model), "Gemini:Model must be configured.")
            .Validate(options => options.TimeoutSeconds > 0, "Gemini:TimeoutSeconds must be greater than zero.")
            .Validate(options => options.MaxResearchOutputTokens > 0, "Gemini:MaxResearchOutputTokens must be greater than zero.")
            .Validate(options => options.MaxExtractionOutputTokens > 0, "Gemini:MaxExtractionOutputTokens must be greater than zero.")
            .Validate(options => options.MaxResponseBytes > 0, "Gemini:MaxResponseBytes must be greater than zero.")
            .ValidateOnStart();

        services
            .AddOptions<AiSafetyCoachOptions>()
            .Bind(configuration.GetSection(AiSafetyCoachOptions.SectionName))
            .Validate(options => string.Equals(options.Language, "en", StringComparison.OrdinalIgnoreCase), "AiSafetyCoach:Language must be 'en' for Phase 4A.")
            .Validate(options => options.FreshnessHours > 0, "AiSafetyCoach:FreshnessHours must be greater than zero.")
            .Validate(options => options.MaxOutputTokens > 0, "AiSafetyCoach:MaxOutputTokens must be greater than zero.")
            .Validate(options => options.MaxSummaryLength > 0, "AiSafetyCoach:MaxSummaryLength must be greater than zero.")
            .Validate(options => options.MaxListItemLength > 0, "AiSafetyCoach:MaxListItemLength must be greater than zero.")
            .Validate(options => options.MaxRiskExplanations > 0, "AiSafetyCoach:MaxRiskExplanations must be greater than zero.")
            .Validate(options => options.MaxWhatToCheckNext > 0, "AiSafetyCoach:MaxWhatToCheckNext must be greater than zero.")
            .Validate(options => options.MaxUncertaintyItems > 0, "AiSafetyCoach:MaxUncertaintyItems must be greater than zero.")
            .Validate(options => options.MaxReviewSignals > 0, "AiSafetyCoach:MaxReviewSignals must be greater than zero.")
            .Validate(options => options.MaxEvidencePerSignal > 0, "AiSafetyCoach:MaxEvidencePerSignal must be greater than zero.")
            .Validate(options => options.MaxClaimSummaries > 0, "AiSafetyCoach:MaxClaimSummaries must be greater than zero.")
            .Validate(options => options.MaxProtocolBreakdownItems > 0, "AiSafetyCoach:MaxProtocolBreakdownItems must be greater than zero.")
            .Validate(options => options.MaxSourcesPerClaim > 0, "AiSafetyCoach:MaxSourcesPerClaim must be greater than zero.")
            .ValidateOnStart();

        services
            .AddOptions<TokenIdentityProvenanceOptions>()
            .Bind(configuration.GetSection(TokenIdentityProvenanceOptions.SectionName))
            .Validate(options => options.MaxReturnedCollisions > 0, "TokenIdentityProvenance:MaxReturnedCollisions must be greater than zero.")
            .ValidateOnStart();

        services
            .AddOptions<OnChainChronologyOptions>()
            .Bind(configuration.GetSection(OnChainChronologyOptions.SectionName))
            .Validate(options => options.PageSize > 0, "OnChainChronology:PageSize must be greater than zero.")
            .Validate(options => options.MaxPages > 0, "OnChainChronology:MaxPages must be greater than zero.")
            .Validate(options => options.MaxSignatures > 0, "OnChainChronology:MaxSignatures must be greater than zero.")
            .Validate(options => options.TimeoutSeconds > 0, "OnChainChronology:TimeoutSeconds must be greater than zero.")
            .Validate(options => options.CompleteFreshnessHours > 0, "OnChainChronology:CompleteFreshnessHours must be greater than zero.")
            .Validate(options => options.PartialFreshnessMinutes > 0, "OnChainChronology:PartialFreshnessMinutes must be greater than zero.")
            .Validate(options => options.FailureFreshnessMinutes > 0, "OnChainChronology:FailureFreshnessMinutes must be greater than zero.")
            .ValidateOnStart();

        services
            .AddOptions<TrustedIdentityProvenanceOptions>()
            .Bind(configuration.GetSection(TrustedIdentityProvenanceOptions.SectionName))
            .Validate(options => options.MaxSources > 0, "TrustedIdentityProvenance:MaxSources must be greater than zero.")
            .Validate(options => options.MaxCompetingMints > 0, "TrustedIdentityProvenance:MaxCompetingMints must be greater than zero.")
            .Validate(options => options.MaxEvidencePerSource > 0, "TrustedIdentityProvenance:MaxEvidencePerSource must be greater than zero.")
            .Validate(options => options.MaxTotalEvidence > 0, "TrustedIdentityProvenance:MaxTotalEvidence must be greater than zero.")
            .Validate(options => options.SourceTimeoutSeconds > 0, "TrustedIdentityProvenance:SourceTimeoutSeconds must be greater than zero.")
            .Validate(options => options.TrustedFreshnessHours > 0, "TrustedIdentityProvenance:TrustedFreshnessHours must be greater than zero.")
            .Validate(options => options.ClaimedFreshnessHours > 0, "TrustedIdentityProvenance:ClaimedFreshnessHours must be greater than zero.")
            .Validate(options => options.UnavailableFreshnessMinutes > 0, "TrustedIdentityProvenance:UnavailableFreshnessMinutes must be greater than zero.")
            .Validate(options => options.ConflictFreshnessMinutes > 0, "TrustedIdentityProvenance:ConflictFreshnessMinutes must be greater than zero.")
            .Validate(options => options.MaxBase58CandidatesPerSource > 0, "TrustedIdentityProvenance:MaxBase58CandidatesPerSource must be greater than zero.")
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
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.TokenResearchCollectionName),
                "MongoDb:TokenResearchCollectionName must be configured when MongoDb:Enabled is true.")
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.TokenInspectionCoachCollectionName),
                "MongoDb:TokenInspectionCoachCollectionName must be configured when MongoDb:Enabled is true.")
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.TokenIdentityObservationCollectionName),
                "MongoDb:TokenIdentityObservationCollectionName must be configured when MongoDb:Enabled is true.")
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.TokenIdentityChronologyCollectionName),
                "MongoDb:TokenIdentityChronologyCollectionName must be configured when MongoDb:Enabled is true.")
            .Validate(
                options => !options.Enabled || !string.IsNullOrWhiteSpace(options.TokenIdentitySourceVerificationCollectionName),
                "MongoDb:TokenIdentitySourceVerificationCollectionName must be configured when MongoDb:Enabled is true.")
            .ValidateOnStart();

        services
            .AddOptions<TokenInspectionCacheOptions>()
            .Bind(configuration.GetSection(TokenInspectionCacheOptions.SectionName))
            .Validate(
                options => options.FreshnessMinutes > 0,
                "TokenInspectionCache:FreshnessMinutes must be greater than zero.")
            .ValidateOnStart();

        services
            .AddOptions<TokenResearchOptions>()
            .Bind(configuration.GetSection(TokenResearchOptions.SectionName))
            .Validate(options => options.FreshnessHours > 0, "TokenResearch:FreshnessHours must be greater than zero.")
            .Validate(options => options.LargestUnknownTokenAccountThresholdPercent >= 0m, "TokenResearch:LargestUnknownTokenAccountThresholdPercent must be non-negative.")
            .Validate(options => options.MaxSources > 0, "TokenResearch:MaxSources must be greater than zero.")
            .Validate(options => options.MaxClaims > 0, "TokenResearch:MaxClaims must be greater than zero.")
            .Validate(options => options.MaxStatementLength > 0, "TokenResearch:MaxStatementLength must be greater than zero.")
            .Validate(options => options.MaxUrlLength > 0, "TokenResearch:MaxUrlLength must be greater than zero.")
            .Validate(options => options.MaxTitleLength > 0, "TokenResearch:MaxTitleLength must be greater than zero.")
            .Validate(options => options.MaxPublisherLength > 0, "TokenResearch:MaxPublisherLength must be greater than zero.")
            .Validate(options => options.ProviderTimeoutSeconds > 0, "TokenResearch:ProviderTimeoutSeconds must be greater than zero.")
            .Validate(options => options.SourceTimeoutSeconds > 0, "TokenResearch:SourceTimeoutSeconds must be greater than zero.")
            .Validate(options => options.MaxRedirects >= 0, "TokenResearch:MaxRedirects must be non-negative.")
            .Validate(options => options.MaxResponseBytes > 0, "TokenResearch:MaxResponseBytes must be greater than zero.")
            .Validate(options => options.AllowedHttpsPorts.Length > 0, "TokenResearch:AllowedHttpsPorts must include at least one port.")
            .Validate(options => options.AllowedHttpsPorts.All(port => port is > 0 and <= 65535), "TokenResearch:AllowedHttpsPorts must contain valid TCP ports.")
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
        services.AddSingleton<TokenIdentityNormalizer>();
        services.AddScoped<IdentitySourceCandidateExtractor>();
        services.AddScoped<IOnChainChronologyService, OnChainChronologyService>();
        services.AddScoped<ITrustedIdentityProvenanceService, TrustedIdentityProvenanceService>();
        services.AddScoped<ITokenIdentityProvenanceService, TokenIdentityProvenanceService>();
        services.AddScoped<AiSafetyCoachInputFactory>();
        services.AddScoped<AiSafetyCoachResponseValidator>();
        services.AddScoped<ITokenInspectionCoachService, TokenInspectionCoachService>();
        services.AddScoped<ITokenResearchOrchestrator, TokenResearchOrchestrator>();
        services.AddScoped<IResearchTrustAssessor, ProductionResearchTrustAssessor>();
        services.AddScoped<NoOpResearchTrustAssessor>();
        services.AddScoped<ResearchRequestFactory>();
        services.AddScoped<DeterministicResearchVerifier>();
        services.AddScoped<ProtocolResearchContextMerger>();
        services.AddScoped<ResearchContentNormalizer>();
        services.AddScoped<SolanaMintEvidenceMatcher>();
        services.AddScoped<TrustedSourceClassifier>();
        services.AddScoped<GeminiGroundingNormalizer>();
        services.AddScoped<GeminiCandidateMapper>(serviceProvider =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<TokenResearchOptions>>().Value;
            return new GeminiCandidateMapper(options);
        });
        services.AddSingleton<ITrustedMintSourceRegistry, TrustedMintSourceRegistry>();
        services.AddScoped<ResearchUrlSafetyPolicy>();
        services.AddSingleton<IResearchDnsResolver, DefaultResearchDnsResolver>();
        services.AddHttpClient<IGeminiInteractionClient, GeminiInteractionClient>((serviceProvider, client) =>
            {
                var options = serviceProvider.GetRequiredService<IOptions<GeminiOptions>>().Value;
                client.BaseAddress = new Uri(options.BaseUrl, UriKind.Absolute);
            })
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                UseCookies = false,
                AutomaticDecompression = System.Net.DecompressionMethods.None
            })
            // Request payloads and headers may contain sensitive metadata; suppress automatic logging.
            .RemoveAllLoggers();
        services.AddHttpClient<IAiSafetyCoach, GeminiAiSafetyCoach>((serviceProvider, client) =>
            {
                var options = serviceProvider.GetRequiredService<IOptions<GeminiOptions>>().Value;
                client.BaseAddress = new Uri(options.BaseUrl, UriKind.Absolute);
            })
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                UseCookies = false,
                AutomaticDecompression = System.Net.DecompressionMethods.None
            })
            // Request payloads and headers may contain sensitive metadata; suppress automatic logging.
            .RemoveAllLoggers();
        services.AddHttpClient<ISafeResearchSourceClient, SafeResearchSourceClient>()
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                AllowAutoRedirect = false,
                UseCookies = false,
                AutomaticDecompression = System.Net.DecompressionMethods.None,
                ConnectCallback = ResearchEndpointPinning.ConnectAsync
            })
            // URLs may carry secrets in query strings; suppress automatic URL logging.
            .RemoveAllLoggers();
        services.AddScoped<CandidateResearchPromoter>(serviceProvider =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<TokenResearchOptions>>().Value;
            return new CandidateResearchPromoter(options);
        });
        services.AddScoped<ResearchNeedDetector>(serviceProvider =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<TokenResearchOptions>>().Value;
            return new ResearchNeedDetector(options);
        });
        services.AddScoped<ITokenResearchProvider, GeminiTokenResearchProvider>();
        services.AddScoped<ISolanaAccountReader, ScopedSolanaAccountReader>();
        services.AddScoped<ITokenMetadataResolver, TokenMetadataResolver>();
        services.AddScoped<ILargestTokenAccountAnalysisService, LargestTokenAccountAnalysisService>();
        services.AddScoped<ITokenAccountClassificationService, TokenAccountClassificationService>();
        services.AddScoped<ITokenAccountClassifier, PumpFunBondingCurveClassifier>();
        services.AddScoped<ITokenAccountClassifier, PumpSwapLiquidityClassifier>();
        services.AddScoped<ITokenAccountClassifier, SkrStakingVaultClassifier>();

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
            services.AddScoped<ITokenResearchRepository, MongoTokenResearchRepository>();
            services.AddScoped<IAiSafetyCoachSnapshotRepository, MongoTokenInspectionCoachSnapshotRepository>();
            services.AddScoped<ITokenIdentityObservationRepository, MongoTokenIdentityObservationRepository>();
            services.AddScoped<ITokenIdentityChronologySnapshotRepository, MongoTokenIdentityChronologySnapshotRepository>();
            services.AddScoped<ITokenIdentitySourceVerificationSnapshotRepository, MongoTokenIdentitySourceVerificationSnapshotRepository>();
            services.AddScoped<CachedTokenInspectionService>();
            services.AddScoped<ITokenInspectionService>(serviceProvider =>
                ActivatorUtilities.CreateInstance<ResearchingTokenInspectionService>(
                    serviceProvider,
                    serviceProvider.GetRequiredService<CachedTokenInspectionService>()));
            services.AddHostedService<MongoIndexInitializerHostedService>();
        }
        else
        {
            services.AddScoped<ITokenResearchRepository, NoOpTokenResearchRepository>();
            services.AddScoped<IAiSafetyCoachSnapshotRepository, NoOpAiSafetyCoachSnapshotRepository>();
            services.AddScoped<ITokenIdentityObservationRepository, NoOpTokenIdentityObservationRepository>();
            services.AddScoped<ITokenIdentityChronologySnapshotRepository, NoOpTokenIdentityChronologySnapshotRepository>();
            services.AddScoped<ITokenIdentitySourceVerificationSnapshotRepository, NoOpTokenIdentitySourceVerificationSnapshotRepository>();
            services.AddScoped<PassthroughTokenInspectionService>();
            services.AddScoped<ITokenInspectionService>(serviceProvider =>
                ActivatorUtilities.CreateInstance<ResearchingTokenInspectionService>(
                    serviceProvider,
                    serviceProvider.GetRequiredService<PassthroughTokenInspectionService>()));
        }

        return services;
    }
}
