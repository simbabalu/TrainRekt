using System.Net;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public sealed record SafeSourceFetchResult(
    bool Success,
    Uri? FinalUri,
    string? NormalizedHost,
    string? ContentType,
    string? Content,
    int BytesRead,
    ResearchSourceAssessmentReason Reason,
    string? Detail);

public interface IResearchDnsResolver
{
    Task<IReadOnlyList<IPAddress>> ResolveAsync(string host, CancellationToken cancellationToken);
}

public interface ISafeResearchSourceClient
{
    Task<SafeSourceFetchResult> FetchAsync(
        CandidateResearchSource candidateSource,
        CancellationToken cancellationToken);
}

public sealed record TrustedMintSourceRegistryEntry(
    string Mint,
    string Protocol,
    IReadOnlyList<string> CanonicalDomains,
    IReadOnlyList<string> OfficialGithubRepositories,
    IReadOnlyDictionary<string, ResearchSourceType> TrustedUrlPrefixes);

public interface ITrustedMintSourceRegistry
{
    bool TryGetByMint(string mint, out TrustedMintSourceRegistryEntry entry);
}
