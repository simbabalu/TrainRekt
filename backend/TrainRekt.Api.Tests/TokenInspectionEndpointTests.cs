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
}
