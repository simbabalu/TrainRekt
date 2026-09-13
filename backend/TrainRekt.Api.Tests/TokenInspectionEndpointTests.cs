using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Contracts;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenInspectionEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public TokenInspectionEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PostTokenInspection_WithInvalidMint_ReturnsBadRequest()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsJsonAsync("/api/token-inspections", new
        {
            mint = "not-a-solana-address"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostTokenInspection_WithSuccessfulInspection_ReturnsExistingProtocolContextContract()
    {
        var inspection = CreateInspectionWithProtocolContext();
        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenInspectionService>();
                services.AddSingleton<ITokenInspectionService>(new StubInspectionService(TokenInspectionResult.Success(inspection)));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsJsonAsync("/api/token-inspections", new
        {
            mint = "ResearchMint1111111111111111111111111111111"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<TokenInspectionResponse>();
        Assert.NotNull(payload);
        Assert.NotNull(payload!.ProtocolContext);
        Assert.NotEmpty(payload.ProtocolContext!.Claims);
    }

    [Fact]
    public async Task PostTokenInspectionCoach_WithInspectionFailure_ReturnsMappedInspectionError()
    {
        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenInspectionCoachService>();
                services.AddSingleton<ITokenInspectionCoachService>(new StubCoachService(
                    new TokenInspectionCoachResult(
                        new TokenInspectionError(TokenInspectionErrorCode.InvalidMint, "bad mint"),
                        AiSafetyCoachStatus.Unavailable,
                        null)));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync("/api/token-inspections/not-a-solana-address/coach", content: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostTokenInspectionCoach_WithAvailableCoach_ReturnsEnvelope()
    {
        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenInspectionCoachService>();
                services.AddSingleton<ITokenInspectionCoachService>(new StubCoachService(
                    new TokenInspectionCoachResult(
                        null,
                        AiSafetyCoachStatus.Available,
                        new AiSafetyCoachPayload(
                            new AiSafetyCoachContent(
                                "summary",
                                new[] { "risk" },
                                new[] { "check" },
                                new[] { "uncertainty" },
                                "token-2022"),
                            1,
                            new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero)))));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync("/api/token-inspections/ResearchMint1111111111111111111111111111111/coach", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<TokenInspectionCoachResponse>();
        Assert.NotNull(payload);
        Assert.True(payload!.Available);
        Assert.Equal("available", payload.Status);
        Assert.NotNull(payload.Coach);
        Assert.Equal("token-2022", payload.Coach!.RecommendedTrainingTopicId);
    }

    [Fact]
    public async Task PostTokenInspectionCoach_WhenUnavailable_ReturnsSafeUnavailableEnvelope()
    {
        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenInspectionCoachService>();
                services.AddSingleton<ITokenInspectionCoachService>(new StubCoachService(
                    new TokenInspectionCoachResult(null, AiSafetyCoachStatus.Disabled, null)));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync("/api/token-inspections/ResearchMint1111111111111111111111111111111/coach", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<TokenInspectionCoachResponse>();
        Assert.NotNull(payload);
        Assert.False(payload!.Available);
        Assert.Equal("disabled", payload.Status);
        Assert.Null(payload.Coach);
    }

    [Fact]
    public async Task PostTokenInspectionProvenance_WithInspectionFailure_ReturnsMappedInspectionError()
    {
        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenIdentityProvenanceService>();
                services.AddSingleton<ITokenIdentityProvenanceService>(new StubProvenanceService(
                    new TokenIdentityProvenanceResult(
                        new TokenInspectionError(TokenInspectionErrorCode.InvalidMint, "bad mint"),
                        null)));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync("/api/token-inspections/not-a-solana-address/provenance", content: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostTokenInspectionProvenance_WithValidResult_ReturnsEnvelope()
    {
        var now = new DateTimeOffset(2026, 2, 3, 4, 5, 6, TimeSpan.Zero);
        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenIdentityProvenanceService>();
                services.AddSingleton<ITokenIdentityProvenanceService>(new StubProvenanceService(
                    new TokenIdentityProvenanceResult(
                        null,
                        new TokenIdentityProvenance(
                            Result: TokenIdentityProvenanceResultType.CollisionObserved,
                            Confidence: TokenIdentityProvenanceConfidence.High,
                            ScannedIdentity: new TokenIdentityProvenanceScannedIdentity(
                                Mint: "ResearchMint1111111111111111111111111111111",
                                RawName: "Research Token",
                                NormalizedName: "research token",
                                RawSymbol: "RCH",
                                NormalizedSymbol: "rch",
                                ObservedAtUtc: now),
                            EarliestObservedMatch: new EarliestObservedIdentityMatch(
                                Mint: "EarlierMint11111111111111111111111111111111",
                                ObservedAtUtc: now.AddMinutes(-10),
                                Semantics: "local-observed"),
                            Collisions: new[]
                            {
                                new TokenIdentityCollision(
                                    CandidateMint: "EarlierMint11111111111111111111111111111111",
                                    RawName: "Research Token",
                                    RawSymbol: "RCH",
                                    MatchDimensions: new[] { TokenIdentityMatchDimension.Name, TokenIdentityMatchDimension.Symbol },
                                    MatchLevel: TokenIdentityMatchLevel.Exact,
                                    FirstObservedAtUtc: now.AddMinutes(-10),
                                    LastObservedAtUtc: now.AddMinutes(-5))
                            },
                            TotalCollisionCount: 1,
                            ReturnedCollisionCount: 1,
                            IsTruncated: false,
                            Evidence: new[] { new TokenIdentityProvenanceEvidence("OBSERVED_MATCH", "Found local observed collision.") },
                            ConflictingEvidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                            Unknowns: new[]
                            {
                                TokenIdentityProvenanceUnknown.GlobalHistoryNotChecked,
                                TokenIdentityProvenanceUnknown.OnChainCreationOrderNotVerified,
                                TokenIdentityProvenanceUnknown.OfficialIdentityNotVerified,
                                TokenIdentityProvenanceUnknown.SocialTrendNotAnalyzed,
                                TokenIdentityProvenanceUnknown.CopycatStatusNotDetermined
                            },
                            AnalyzedAtUtc: now))));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync("/api/token-inspections/ResearchMint1111111111111111111111111111111/provenance", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<TokenIdentityProvenanceResponse>();
        Assert.NotNull(payload);
        Assert.Equal("COLLISION_OBSERVED", payload!.Result);
        Assert.Equal("HIGH", payload.Confidence);
        Assert.Single(payload.Collisions);
        Assert.Equal("EXACT", payload.Collisions[0].MatchLevel);
        Assert.Contains("GLOBAL_HISTORY_NOT_CHECKED", payload.Unknowns);
    }

    [Fact]
    public async Task PostTokenInspectionProvenance_UsesDeterministicInspectionBoundary_NotFinalInspectionService()
    {
        var deterministicInspection = ResearchTestData.CreateInspection() with
        {
            Identity = ResearchTestData.CreateInspection().Identity with { Mint = "So11111111111111111111111111111111111111112" }
        };

        var deterministic = new CountingDeterministicInspectionService(TokenInspectionResult.Success(deterministicInspection));
        var finalInspection = new ThrowingFinalInspectionService();

        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenIdentityProvenanceService>();
                services.RemoveAll<ITokenInspectionDeterministicService>();
                services.RemoveAll<ITokenInspectionService>();
                services.RemoveAll<ITokenIdentityObservationRepository>();
                services.RemoveAll<IOnChainChronologyService>();

                services.AddSingleton<ITokenInspectionDeterministicService>(deterministic);
                services.AddSingleton<ITokenInspectionService>(finalInspection);
                services.AddSingleton<ITokenIdentityObservationRepository>(new NoOpTokenIdentityObservationRepository());
                services.AddSingleton<IOnChainChronologyService>(new StubChronologyService());
                services.AddSingleton<ITokenIdentityProvenanceService>(serviceProvider =>
                    new TokenIdentityProvenanceService(
                        serviceProvider.GetRequiredService<ITokenInspectionDeterministicService>(),
                        serviceProvider.GetRequiredService<ITokenIdentityObservationRepository>(),
                        serviceProvider.GetRequiredService<IOnChainChronologyService>(),
                        new StubTrustedIdentityProvenanceService(),
                        new TokenIdentityClassifier(),
                        new TokenIdentityNormalizer(),
                        Options.Create(new TokenIdentityProvenanceOptions { MaxReturnedCollisions = 25 }),
                        Options.Create(new TokenIdentityClassificationOptions { MaxClassificationCompetitors = 1 }),
                        TimeProvider.System,
                        Microsoft.Extensions.Logging.Abstractions.NullLogger<TokenIdentityProvenanceService>.Instance));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync("/api/token-inspections/So11111111111111111111111111111111111111112/provenance", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, deterministic.CallCount);
        Assert.Equal(0, finalInspection.CallCount);
    }

    [Fact]
    public async Task PostTokenInspection_StillUsesFinalInspectionService()
    {
        var finalInspection = new StubInspectionService(TokenInspectionResult.Success(ResearchTestData.CreateInspection() with
        {
            Identity = ResearchTestData.CreateInspection().Identity with { Mint = "FinalMint111111111111111111111111111111111" }
        }));

        var deterministic = new CountingDeterministicInspectionService(TokenInspectionResult.Success(ResearchTestData.CreateInspection() with
        {
            Identity = ResearchTestData.CreateInspection().Identity with { Mint = "DeterministicMint111111111111111111111111111" }
        }));

        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenInspectionService>();
                services.RemoveAll<ITokenInspectionDeterministicService>();
                services.AddSingleton<ITokenInspectionService>(finalInspection);
                services.AddSingleton<ITokenInspectionDeterministicService>(deterministic);
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsJsonAsync("/api/token-inspections", new
        {
            mint = "So11111111111111111111111111111111111111112"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<TokenInspectionResponse>();
        Assert.NotNull(payload);
        Assert.Equal("FinalMint111111111111111111111111111111111", payload!.Identity.Mint);
        Assert.Equal(0, deterministic.CallCount);
    }

    [Fact]
    public async Task PostTokenInspectionProvenance_DoesNotInvokeResearchOrchestratorPath()
    {
        var deterministicInspection = ResearchTestData.CreateInspection() with
        {
            Identity = ResearchTestData.CreateInspection().Identity with { Mint = "So11111111111111111111111111111111111111112" }
        };

        var deterministic = new CountingDeterministicInspectionService(TokenInspectionResult.Success(deterministicInspection));
        var orchestrator = new ThrowingResearchOrchestrator();

        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenIdentityProvenanceService>();
                services.RemoveAll<ITokenInspectionDeterministicService>();
                services.RemoveAll<ITokenIdentityObservationRepository>();
                services.RemoveAll<IOnChainChronologyService>();
                services.RemoveAll<ITrustedIdentityProvenanceService>();
                services.RemoveAll<ITokenResearchOrchestrator>();

                services.AddSingleton<ITokenInspectionDeterministicService>(deterministic);
                services.AddSingleton<ITokenIdentityObservationRepository>(new NoOpTokenIdentityObservationRepository());
                services.AddSingleton<IOnChainChronologyService>(new StubChronologyService());
                services.AddSingleton<ITrustedIdentityProvenanceService>(new StubTrustedIdentityProvenanceService());
                services.AddSingleton<ITokenResearchOrchestrator>(orchestrator);
                services.AddSingleton<ITokenIdentityProvenanceService>(serviceProvider =>
                    new TokenIdentityProvenanceService(
                        serviceProvider.GetRequiredService<ITokenInspectionDeterministicService>(),
                        serviceProvider.GetRequiredService<ITokenIdentityObservationRepository>(),
                        serviceProvider.GetRequiredService<IOnChainChronologyService>(),
                        serviceProvider.GetRequiredService<ITrustedIdentityProvenanceService>(),
                        new TokenIdentityClassifier(),
                        new TokenIdentityNormalizer(),
                        Options.Create(new TokenIdentityProvenanceOptions { MaxReturnedCollisions = 25 }),
                        Options.Create(new TokenIdentityClassificationOptions { MaxClassificationCompetitors = 1 }),
                        TimeProvider.System,
                        Microsoft.Extensions.Logging.Abstractions.NullLogger<TokenIdentityProvenanceService>.Instance));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync("/api/token-inspections/So11111111111111111111111111111111111111112/provenance", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, deterministic.CallCount);
        Assert.Equal(0, orchestrator.CallCount);
    }

    [Fact]
    public async Task PostTokenInspectionProvenance_ResponseExposesTrustedIdentityProvenanceWithoutCopycatOrSafetyVerdicts()
    {
        var configuredFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITokenIdentityProvenanceService>();
                services.AddSingleton<ITokenIdentityProvenanceService>(new StubProvenanceService(
                    new TokenIdentityProvenanceResult(
                        null,
                        new TokenIdentityProvenance(
                            Result: TokenIdentityProvenanceResultType.CollisionObserved,
                            Confidence: TokenIdentityProvenanceConfidence.High,
                            ScannedIdentity: new TokenIdentityProvenanceScannedIdentity(
                                Mint: "ResearchMint1111111111111111111111111111111",
                                RawName: "Research Token",
                                NormalizedName: "research token",
                                RawSymbol: "RCH",
                                NormalizedSymbol: "rch",
                                ObservedAtUtc: DateTimeOffset.UtcNow),
                            EarliestObservedMatch: null,
                            Collisions: Array.Empty<TokenIdentityCollision>(),
                            TotalCollisionCount: 0,
                            ReturnedCollisionCount: 0,
                            IsTruncated: false,
                            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                            ConflictingEvidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                            Unknowns: new[] { TokenIdentityProvenanceUnknown.CanonicalCreationTimeNotProven },
                            AnalyzedAtUtc: DateTimeOffset.UtcNow,
                            OnChainChronology: new OnChainChronologyEvidence(
                                EarliestObservedSignature: null,
                                EarliestObservedSlot: null,
                                EarliestObservedBlockTimeUtc: null,
                                HistoryCoverage: OnChainChronologyCoverage.Unavailable,
                                PaginationExhausted: false,
                                PagesScanned: 0,
                                SignaturesScanned: 0,
                                Source: "HELIUS_SOLANA_RPC",
                                Confidence: OnChainChronologyConfidence.None,
                                Precision: OnChainChronologyPrecision.ObservedTransactionOnly,
                                AccountCreationProven: false,
                                Unknowns: new[] { OnChainChronologyUnknown.CanonicalCreationTimeNotProven },
                                AnalyzedAtUtc: DateTimeOffset.UtcNow),
                            TrustedIdentityProvenance: new TrustedIdentityProvenance(
                                Sources: new[]
                                {
                                    new IdentitySourceEvidence(
                                        Url: "https://example.com/project",
                                        Publisher: "Project",
                                        SourceTrust: IdentitySourceTrust.ClaimedProjectSource,
                                        MintLinkStatus: IdentityMintLinkStatus.ReferencesScannedMint,
                                        ReferencedRelevantMints: new[] { "ResearchMint1111111111111111111111111111111" },
                                        EvidenceSummary: "A project-linked source references this mint, but source ownership has not been independently verified.")
                                },
                                Evidence: new[]
                                {
                                    new TokenIdentityProvenanceEvidence("SOURCE_REFERENCES_SCANNED_MINT", "Source references scanned mint.")
                                },
                                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                                Unknowns: new[]
                                {
                                    TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified
                                },
                                AnalyzedAtUtc: DateTimeOffset.UtcNow)))));
            });
        });

        using var client = configuredFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });

        var response = await client.PostAsync("/api/token-inspections/ResearchMint1111111111111111111111111111111/provenance", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("trustedIdentityProvenance", json, StringComparison.Ordinal);
        Assert.Contains("onChainChronology", json, StringComparison.Ordinal);
        Assert.DoesNotContain("social", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("CONFIRMED_COPYCAT", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("original", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("safe", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("scam", json, StringComparison.OrdinalIgnoreCase);
    }

    private static TokenInspection CreateInspectionWithProtocolContext()
    {
        var context = new ProtocolResearchContext(
            Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
            Sources: new[]
            {
                new ResearchSource(
                    Id: ProtocolConstants.SolanaMobileSkrTokenomicsSourceId,
                    SourceType: ResearchSourceType.OfficialDocumentation,
                    Title: "SKR docs",
                    Publisher: "Solana Mobile",
                    Url: "https://docs.solanamobile.com/solana-mobile-stack/skr",
                    RetrievedAtUtc: null,
                    PublishedAtUtc: null)
            },
            Claims: new[]
            {
                new DocumentedClaim(
                    Id: ResearchClaimIds.DocumentedInflationaryIssuance,
                    Category: "issuance",
                    Statement: "Issuance documented.",
                    VerificationStatus: ResearchClaimVerificationStatus.Documented,
                    VerificationMethod: ResearchClaimVerificationMethod.DocumentationOnly,
                    SourceIds: new[] { ProtocolConstants.SolanaMobileSkrTokenomicsSourceId },
                    ObservedFactReferences: Array.Empty<ObservedFactReference>(),
                    VerificationNote: null,
                    Consistency: ObservedConsistency.Unknown)
            });

        return ResearchTestData.CreateInspection(protocolContext: context);
    }

    private sealed class StubInspectionService : ITokenInspectionService
    {
        private readonly TokenInspectionResult _result;

        public StubInspectionService(TokenInspectionResult result)
        {
            _result = result;
        }

        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult(_result);
        }
    }

    private sealed class StubCoachService : ITokenInspectionCoachService
    {
        private readonly TokenInspectionCoachResult _result;

        public StubCoachService(TokenInspectionCoachResult result)
        {
            _result = result;
        }

        public Task<TokenInspectionCoachResult> GenerateAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult(_result);
        }
    }

    private sealed class StubProvenanceService : ITokenIdentityProvenanceService
    {
        private readonly TokenIdentityProvenanceResult _result;

        public StubProvenanceService(TokenIdentityProvenanceResult result)
        {
            _result = result;
        }

        public Task<TokenIdentityProvenanceResult> AnalyzeAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult(_result);
        }
    }

    private sealed class ThrowingFinalInspectionService : ITokenInspectionService
    {
        public int CallCount { get; private set; }

        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            CallCount += 1;
            throw new InvalidOperationException("final inspection should not be used by provenance");
        }
    }

    private sealed class CountingDeterministicInspectionService : ITokenInspectionDeterministicService
    {
        private readonly TokenInspectionResult _result;

        public CountingDeterministicInspectionService(TokenInspectionResult result)
        {
            _result = result;
        }

        public int CallCount { get; private set; }

        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            CallCount += 1;
            return Task.FromResult(_result);
        }
    }

    private sealed class StubChronologyService : IOnChainChronologyService
    {
        public Task<OnChainChronologyEvidence> AnalyzeAsync(string mint, CancellationToken cancellationToken)
        {
            return Task.FromResult(new OnChainChronologyEvidence(
                EarliestObservedSignature: null,
                EarliestObservedSlot: null,
                EarliestObservedBlockTimeUtc: null,
                HistoryCoverage: OnChainChronologyCoverage.Unavailable,
                PaginationExhausted: false,
                PagesScanned: 0,
                SignaturesScanned: 0,
                Source: "HELIUS_SOLANA_RPC",
                Confidence: OnChainChronologyConfidence.None,
                Precision: OnChainChronologyPrecision.ObservedTransactionOnly,
                AccountCreationProven: false,
                Unknowns: new[]
                {
                    OnChainChronologyUnknown.CanonicalCreationTimeNotProven,
                    OnChainChronologyUnknown.ChainHistoryUnavailable
                },
                AnalyzedAtUtc: DateTimeOffset.UtcNow));
        }
    }

    private sealed class StubTrustedIdentityProvenanceService : ITrustedIdentityProvenanceService
    {
        public Task<TrustedIdentityProvenance> AnalyzeAsync(
            TrustedIdentityProvenanceRequest request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new TrustedIdentityProvenance(
                Sources: Array.Empty<IdentitySourceEvidence>(),
                Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: new[]
                {
                    TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable,
                    TrustedIdentityProvenanceUnknown.OfficialIdentityNotVerified
                },
                AnalyzedAtUtc: DateTimeOffset.UtcNow));
        }
    }

    private sealed class ThrowingResearchOrchestrator : ITokenResearchOrchestrator
    {
        public int CallCount { get; private set; }

        public Task<ResearchOutcome> RunAsync(TokenInspection inspection, CancellationToken cancellationToken)
        {
            CallCount += 1;
            throw new InvalidOperationException("research orchestrator should not be used by provenance");
        }
    }
}
