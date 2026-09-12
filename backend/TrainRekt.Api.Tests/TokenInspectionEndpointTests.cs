using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

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
}
