using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using TrainRekt.Api.Api.Contracts;
using TrainRekt.Api.Application.Abstractions;
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
}
