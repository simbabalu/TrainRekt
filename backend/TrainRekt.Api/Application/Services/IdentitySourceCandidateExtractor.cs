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
    private readonly ITrustedMintSourceRegistry _mintRegistry;

    public IdentitySourceCandidateExtractor(ITrustedMintSourceRegistry registry)
    {
        _mintRegistry = registry;
    }

    public IReadOnlyList<IdentitySourceCandidate> Extract(
        string scannedMint,
        string? metadataUri,
        int maxSources,
        TrustedProjectSourcePolicy? resolvedProjectPolicy = null)
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

        if (resolvedProjectPolicy is not null)
        {
            foreach (var trustedPrefix in resolvedProjectPolicy.TrustedUrlPrefixes.OrderBy(entry => entry.Key, StringComparer.Ordinal))
            {
                if (!seenUrls.Add(trustedPrefix.Key))
                {
                    continue;
                }

                candidates.Add(new IdentitySourceCandidate(
                    Url: trustedPrefix.Key,
                    Publisher: resolvedProjectPolicy.ProjectKey,
                    InitialTrust: IdentitySourceTrust.Trusted,
                    DiscoveredFromTokenMetadata: false));

                if (candidates.Count >= maxSources)
                {
                    break;
                }
            }
        }

        if (_mintRegistry.TryGetByMint(scannedMint, out var registryEntry))
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
