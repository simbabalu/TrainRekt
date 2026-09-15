using Microsoft.Extensions.Logging.Abstractions;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Tests;

public sealed class ResearchingTokenInspectionServiceTests
{
    [Fact]
    public async Task InspectAsync_DeterministicFailure_ReturnedUnchanged_AndInnerCalledOnce()
    {
        var expected = TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderUnavailable, "provider unavailable");
        var inner = new StubInspectionService(expected);
        var service = CreateService(inner);

        var result = await service.InspectAsync("mint", CancellationToken.None);

        Assert.Same(expected, result);
        Assert.Null(result.Inspection);
        Assert.Equal(1, inner.CallCount);
    }

    [Fact]
    public async Task InspectAsync_NoResearchNeedDetected_ReturnsNotAttemptedResearchStatus()
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: true, freezeAuthorityRevoked: true, largestUnknownTokenAccountPercentage: null);
        var inner = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var service = CreateService(inner);

        var result = await service.InspectAsync(inspection.Identity.Mint, CancellationToken.None);

        Assert.Equal(1, inner.CallCount);
        Assert.NotNull(result.Inspection);
        Assert.Same(inspection, result.Inspection);
        Assert.NotNull(result.ResearchStatus);
        Assert.Equal(TokenInspectionResearchAvailability.NotAttempted, result.ResearchStatus!.Availability);
        Assert.Null(result.ResearchStatus.FailureCategory);
        Assert.Null(result.ResearchStatus.FailureStage);
        Assert.Null(result.ResearchStatus.Message);
    }

    [Fact]
    public async Task InspectAsync_ResearchNeedDetected_StaysNotAttempted_WithoutExternalOrRepositoryWork()
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false, freezeAuthorityRevoked: false, largestUnknownTokenAccountPercentage: null);
        var inner = new StubInspectionService(TokenInspectionResult.Success(inspection));
        var service = CreateService(inner);

        var result = await service.InspectAsync(inspection.Identity.Mint, CancellationToken.None);

        // Observable API shape matches the "no research required" case exactly: research is
        // deferred outside the deterministic inspect response path and never attempted inline,
        // since the legacy enrichment provider/repository no longer exist.
        Assert.Equal(1, inner.CallCount);
        Assert.NotNull(result.Inspection);
        Assert.Same(inspection, result.Inspection);
        Assert.NotNull(result.ResearchStatus);
        Assert.Equal(TokenInspectionResearchAvailability.NotAttempted, result.ResearchStatus!.Availability);
        Assert.Null(result.ResearchStatus.FailureCategory);
        Assert.Null(result.ResearchStatus.FailureStage);
        Assert.Null(result.ResearchStatus.Message);
    }

    [Fact]
    public async Task InspectAsync_DeterministicInspectionReturnsNullInspection_ReturnedUnchanged()
    {
        var expected = TokenInspectionResult.Failure(TokenInspectionErrorCode.InvalidMint, "bad");
        var inner = new StubInspectionService(expected);
        var service = CreateService(inner);

        var result = await service.InspectAsync("bad", CancellationToken.None);

        Assert.Same(expected, result);
        Assert.Null(result.Inspection);
        Assert.Null(result.ResearchStatus);
    }

    [Fact]
    public async Task InspectAsync_CallerCancellation_FromDeterministicInspection_Propagates()
    {
        var inner = new CancellingInspectionService();
        var service = CreateService(inner);
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.InspectAsync("ResearchMint1111111111111111111111111111111", cts.Token));
    }

    private static ResearchingTokenInspectionService CreateService(ITokenInspectionService inner)
    {
        return new ResearchingTokenInspectionService(
            inner,
            new ResearchNeedDetector(new TokenResearchOptions()),
            NullLogger<ResearchingTokenInspectionService>.Instance);
    }

    private sealed class StubInspectionService : ITokenInspectionService
    {
        private readonly TokenInspectionResult _result;

        public StubInspectionService(TokenInspectionResult result)
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

    private sealed class CancellingInspectionService : ITokenInspectionService
    {
        public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw new OperationCanceledException("cancelled");
        }
    }
}
