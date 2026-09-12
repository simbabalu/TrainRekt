using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public sealed record CachedTokenResearchSnapshot(
    string Id,
    string Mint,
    string Protocol,
    int ResearchVersion,
    DateTimeOffset ResearchedAtUtc,
    DateTimeOffset CachedAtUtc,
    DateTimeOffset ExpiresAtUtc,
    ProtocolResearchContext Context);

public interface ITokenResearchRepository
{
    Task<CachedTokenResearchSnapshot?> GetLatestFreshAsync(
        string mint,
        int researchVersion,
        DateTimeOffset nowUtc,
        CancellationToken cancellationToken);

    Task<CachedTokenResearchSnapshot?> GetLatestByMintAsync(
        string mint,
        CancellationToken cancellationToken);

    Task InsertAsync(CachedTokenResearchSnapshot snapshot, CancellationToken cancellationToken);
}
