using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Research;

public sealed class NoOpTokenResearchRepository : ITokenResearchRepository
{
    public Task<CachedTokenResearchSnapshot?> GetLatestFreshAsync(
        string mint,
        int researchVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken)
    {
        return Task.FromResult<CachedTokenResearchSnapshot?>(null);
    }

    public Task<CachedTokenResearchSnapshot?> GetLatestByMintAsync(string mint, CancellationToken cancellationToken)
    {
        return Task.FromResult<CachedTokenResearchSnapshot?>(null);
    }

    public Task InsertAsync(CachedTokenResearchSnapshot snapshot, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
