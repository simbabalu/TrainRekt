using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed record IdentitySourceCandidate(
    string Url,
    string Publisher,
    IdentitySourceTrust InitialTrust,
    bool DiscoveredFromTokenMetadata);

public sealed class IdentitySourceCandidateExtractor
{
    private readonly ITrustedMintSourceRegistry _registry;

    public IdentitySourceCandidateExtractor(ITrustedMintSourceRegistry registry)
    {
        _registry = registry;
    }

    public IReadOnlyList<IdentitySourceCandidate> Extract(
        string scannedMint,
        string? metadataUri,
        int maxSources)
    {
        var candidates = new List<IdentitySourceCandidate>();
        var seenUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(metadataUri)
            && seenUrls.Add(metadataUri))
        {
            candidates.Add(new IdentitySourceCandidate(
                Url: metadataUri,
                Publisher: "Token metadata",
                InitialTrust: IdentitySourceTrust.ClaimedProjectSource,
                DiscoveredFromTokenMetadata: true));
        }

        if (_registry.TryGetByMint(scannedMint, out var registryEntry))
        {
            foreach (var trustedPrefix in registryEntry.TrustedUrlPrefixes.OrderBy(entry => entry.Key, StringComparer.Ordinal))
            {
                if (!seenUrls.Add(trustedPrefix.Key))
                {
                    continue;
                }

                candidates.Add(new IdentitySourceCandidate(
                    Url: trustedPrefix.Key,
                    Publisher: registryEntry.Protocol,
                    InitialTrust: IdentitySourceTrust.Trusted,
                    DiscoveredFromTokenMetadata: false));

                if (candidates.Count >= maxSources)
                {
                    break;
                }
            }
        }

        return candidates.Take(maxSources).ToArray();
    }
}
