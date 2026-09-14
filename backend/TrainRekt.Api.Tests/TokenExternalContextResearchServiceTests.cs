using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenExternalContextResearchServiceTests
{
    [Fact]
    public async Task GetContextAsync_UsesExactMintAsAnchor()
    {
        var provider = new StubExternalContextProvider();
        var service = CreateService(provider);
        var inspection = ResearchTestData.CreateInspection();

        _ = await service.GetContextAsync(inspection, provenance: null, CancellationToken.None);

        Assert.Equal(inspection.Identity.Mint, provider.LastRequest!.Mint);
    }

    [Fact]
    public async Task GetContextAsync_Timeout_ReturnsUnavailableAndDoesNotThrow()
    {
        var provider = new StubExternalContextProvider { ThrowTimeout = true };
        var service = CreateService(provider);

        var result = await service.GetContextAsync(ResearchTestData.CreateInspection(), provenance: null, CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.Timeout, result.FailureReason);
    }

    [Fact]
    public async Task GetContextAsync_NetworkFailure_ReturnsUnavailableAndDoesNotThrow()
    {
        var provider = new StubExternalContextProvider { ThrowHttp = true };
        var service = CreateService(provider);

        var result = await service.GetContextAsync(ResearchTestData.CreateInspection(), provenance: null, CancellationToken.None);

        Assert.Equal(TokenExternalContextAvailability.Unavailable, result.Availability);
        Assert.Equal(TokenExternalContextFailureReason.NetworkFailure, result.FailureReason);
    }

    [Fact]
    public async Task GetContextAsync_CallerCancellation_Propagates()
    {
        var provider = new StubExternalContextProvider { RespectCancellation = true };
        var service = CreateService(provider);
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.GetContextAsync(ResearchTestData.CreateInspection(), provenance: null, cts.Token));
    }

    [Fact]
    public async Task GetContextAsync_BoundsEvidenceAndSummary()
    {
        var provider = new StubExternalContextProvider
        {
            Next = new TokenExternalContext(
                TokenExternalContextAvailability.Available,
                TokenExternalAssetType.TokenizedStock,
                "ProjectNameWithLongLength",
                "This summary is significantly longer than the configured max and should be truncated safely.",
                "MEDIUM",
                true,
                false,
                new[]
                {
                    new TokenExternalContextEvidence(TokenExternalContextSourceType.OfficialProjectWebsite, "A very long source title", "example.com", "claim one that is very long", "https://example.com/a"),
                    new TokenExternalContextEvidence(TokenExternalContextSourceType.OfficialDocumentation, "Another very long source title", "example.com", "claim two that is very long", "https://example.com/b"),
                    new TokenExternalContextEvidence(TokenExternalContextSourceType.StructuredTokenDirectory, "Extra", "example.com", "claim three", "https://example.com/c")
                })
        };

        var service = CreateService(provider, new TokenExternalContextOptions
        {
            Enabled = true,
            FreshnessHours = 1,
            TimeoutSeconds = 5,
            MaxOutputTokens = 100,
            MaxSummaryLength = 24,
            MaxProjectNameLength = 12,
            MaxEvidenceItems = 2,
            MaxEvidenceClaimLength = 12,
            MaxEvidenceTitleLength = 12,
            MaxKnownOfficialUrls = 3,
            MaxCacheEntries = 16
        });

        var result = await service.GetContextAsync(ResearchTestData.CreateInspection(), provenance: null, CancellationToken.None);

        Assert.True(result.Summary!.Length <= 24);
        Assert.True(result.ProjectName!.Length <= 12);
        Assert.True(result.Evidence.Count <= 2);
        Assert.All(result.Evidence, item => Assert.True(item.Claim.Length <= 12));
    }

    [Fact]
    public async Task GetContextAsync_CachesAvailableResultByMint()
    {
        var provider = new StubExternalContextProvider();
        var service = CreateService(provider);
        var inspection = ResearchTestData.CreateInspection();

        _ = await service.GetContextAsync(inspection, provenance: null, CancellationToken.None);
        _ = await service.GetContextAsync(inspection, provenance: null, CancellationToken.None);

        Assert.Equal(1, provider.CallCount);
    }

    private static TokenExternalContextResearchService CreateService(
        ITokenExternalContextProvider provider,
        TokenExternalContextOptions? options = null)
    {
        options ??= new TokenExternalContextOptions();
        return new TokenExternalContextResearchService(
            provider,
            Options.Create(options),
            TimeProvider.System,
            NullLogger<TokenExternalContextResearchService>.Instance);
    }

    private sealed class StubExternalContextProvider : ITokenExternalContextProvider
    {
        public int CallCount { get; private set; }

        public TokenExternalContextRequest? LastRequest { get; private set; }

        public bool ThrowTimeout { get; set; }

        public bool ThrowHttp { get; set; }

        public bool RespectCancellation { get; set; }

        public TokenExternalContext Next { get; set; } = new(
            TokenExternalContextAvailability.Available,
            TokenExternalAssetType.ProtocolToken,
            "Project",
            "Context summary.",
            "MEDIUM",
            true,
            false,
            Array.Empty<TokenExternalContextEvidence>());

        public Task<TokenExternalContext> ResearchAsync(TokenExternalContextRequest request, CancellationToken cancellationToken)
        {
            CallCount += 1;
            LastRequest = request;

            if (RespectCancellation)
            {
                cancellationToken.ThrowIfCancellationRequested();
            }

            if (ThrowTimeout)
            {
                throw new OperationCanceledException("timeout");
            }

            if (ThrowHttp)
            {
                throw new HttpRequestException("network");
            }

            return Task.FromResult(Next);
        }
    }
}
