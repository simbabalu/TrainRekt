using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

public sealed class NoOpTokenIdentityObservationRepository : ITokenIdentityObservationRepository
{
    public Task<TokenIdentityObservation?> GetByMintAsync(string mint, CancellationToken cancellationToken)
    {
        return Task.FromResult<TokenIdentityObservation?>(null);
    }

    public Task UpsertAsync(TokenIdentityObservation observation, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public Task<TokenIdentityObservationQueryResult> FindCollisionsAsync(
        string excludingMint,
        string? normalizedName,
        string? normalizedSymbol,
        int limit,
        CancellationToken cancellationToken)
    {
        return Task.FromResult(new TokenIdentityObservationQueryResult(0, Array.Empty<TokenIdentityObservation>()));
    }
}
