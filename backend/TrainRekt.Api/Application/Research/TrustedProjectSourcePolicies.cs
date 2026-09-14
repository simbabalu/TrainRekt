using System.Globalization;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Application.Research;

public sealed record TrustedProjectSourcePolicy(
    string ProjectKey,
    IReadOnlyList<string> Aliases,
    IReadOnlyList<string> OfficialDomains,
    IReadOnlyList<string> OfficialDocsRoots,
    IReadOnlyList<string> OfficialGithubOrganizations,
    IReadOnlyList<string> OfficialGithubRepositories,
    IReadOnlyDictionary<string, ResearchSourceType> TrustedUrlPrefixes);

public interface ITrustedProjectSourcePolicyRegistry
{
    IReadOnlyList<TrustedProjectSourcePolicy> List();
}

public interface ITrustedProjectPolicyResolver
{
    TrustedProjectSourcePolicy? Resolve(string scannedMint, string? metadataUri);
}

public sealed class TrustedProjectSourcePolicyRegistry : ITrustedProjectSourcePolicyRegistry
{
    private readonly IReadOnlyList<TrustedProjectSourcePolicy> _policies;

    public TrustedProjectSourcePolicyRegistry()
    {
        // First-party SKR policy derived from existing in-repo SKR trust anchors.
        var skr = new TrustedProjectSourcePolicy(
            ProjectKey: ProtocolConstants.SolanaMobileSkrProtocolName,
            Aliases: new[]
            {
                "solana-mobile",
                "skr",
                "solana-mobile-skr"
            },
            OfficialDomains: new[]
            {
                "solanamobile.com",
                "docs.solanamobile.com"
            },
            OfficialDocsRoots: new[]
            {
                "https://docs.solanamobile.com/solana-mobile-stack/skr"
            },
            OfficialGithubOrganizations: new[]
            {
                "solana-mobile"
            },
            OfficialGithubRepositories: new[]
            {
                "solana-mobile/react-native-samples"
            },
            TrustedUrlPrefixes: new Dictionary<string, ResearchSourceType>(StringComparer.Ordinal)
            {
                ["https://solanamobile.com/skr"] = ResearchSourceType.ProjectWebsite,
                ["https://docs.solanamobile.com/solana-mobile-stack/skr"] = ResearchSourceType.OfficialDocumentation,
                ["https://github.com/solana-mobile/react-native-samples/"] = ResearchSourceType.OfficialRepository,
                ["https://raw.githubusercontent.com/solana-mobile/react-native-samples/"] = ResearchSourceType.OfficialRepository,
                ["https://raw.githubusercontent.com/solana-mobile/react-native-samples/main/skr-staking/program/idl.json"] = ResearchSourceType.OfficialIdl,
            });

        // First-party Jupiter policy: official website/docs and official GitHub org scope.
        // These anchors define trust boundaries only; they do not assert token validity.
        var jupiter = new TrustedProjectSourcePolicy(
            ProjectKey: "jupiter",
            Aliases: new[]
            {
                "jupiter",
                "jup"
            },
            OfficialDomains: new[]
            {
                "jup.ag",
                "station.jup.ag",
                "docs.jup.ag"
            },
            OfficialDocsRoots: new[]
            {
                "https://station.jup.ag/",
                "https://docs.jup.ag/"
            },
            OfficialGithubOrganizations: new[]
            {
                "jup-ag"
            },
            OfficialGithubRepositories: Array.Empty<string>(),
            TrustedUrlPrefixes: new Dictionary<string, ResearchSourceType>(StringComparer.Ordinal)
            {
                ["https://jup.ag/"] = ResearchSourceType.ProjectWebsite,
                ["https://station.jup.ag/"] = ResearchSourceType.OfficialDocumentation,
                ["https://docs.jup.ag/"] = ResearchSourceType.OfficialDocumentation,
                ["https://github.com/jup-ag/"] = ResearchSourceType.OfficialRepository,
                ["https://raw.githubusercontent.com/jup-ag/"] = ResearchSourceType.OfficialRepository,
            });

        _policies = new[]
        {
            skr,
            jupiter,
        };
    }

    public IReadOnlyList<TrustedProjectSourcePolicy> List()
    {
        return _policies;
    }
}

public sealed class DeterministicTrustedProjectPolicyResolver : ITrustedProjectPolicyResolver
{
    private readonly ITrustedProjectSourcePolicyRegistry _projectRegistry;
    private readonly ITrustedMintSourceRegistry _mintRegistry;

    public DeterministicTrustedProjectPolicyResolver(
        ITrustedProjectSourcePolicyRegistry projectRegistry,
        ITrustedMintSourceRegistry mintRegistry)
    {
        _projectRegistry = projectRegistry;
        _mintRegistry = mintRegistry;
    }

    public TrustedProjectSourcePolicy? Resolve(string scannedMint, string? metadataUri)
    {
        if (!SolanaPublicKeyValidator.TryNormalize(scannedMint, out var normalizedMint))
        {
            return null;
        }

        var matches = new List<TrustedProjectSourcePolicy>();
        var policies = _projectRegistry.List();

        if (TryNormalizeMetadataUri(metadataUri, out var normalizedMetadataUri))
        {
            foreach (var policy in policies)
            {
                if (MatchesPolicyByMetadataUri(policy, normalizedMetadataUri))
                {
                    matches.Add(policy);
                }
            }
        }

        if (matches.Count == 1)
        {
            return matches[0];
        }

        if (matches.Count > 1)
        {
            return null;
        }

        if (!_mintRegistry.TryGetByMint(normalizedMint, out var legacyMintEntry))
        {
            return null;
        }

        var legacyMatches = policies.Where(policy => OverlapsWithLegacyEntry(policy, legacyMintEntry)).ToArray();
        return legacyMatches.Length == 1 ? legacyMatches[0] : null;
    }

    private static bool TryNormalizeMetadataUri(string? metadataUri, out Uri uri)
    {
        uri = default!;
        if (string.IsNullOrWhiteSpace(metadataUri))
        {
            return false;
        }

        if (!Uri.TryCreate(metadataUri, UriKind.Absolute, out var parsed))
        {
            return false;
        }

        if (!string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (NormalizeHost(parsed.Host) is not { } normalizedHost)
        {
            return false;
        }

        var normalizedBuilder = new UriBuilder(parsed)
        {
            Host = normalizedHost,
        };

        uri = normalizedBuilder.Uri;
        return true;
    }

    private static bool MatchesPolicyByMetadataUri(TrustedProjectSourcePolicy policy, Uri metadataUri)
    {
        if (policy.OfficialDomains.Contains(metadataUri.Host, StringComparer.OrdinalIgnoreCase))
        {
            return true;
        }

        foreach (var docsRoot in policy.OfficialDocsRoots)
        {
            if (TryCreateAbsolute(docsRoot, out var docsRootUri)
                && docsRootUri is not null
                && IsTrustedPrefixMatch(metadataUri, docsRootUri, docsRoot))
            {
                return true;
            }
        }

        foreach (var trustedPrefix in policy.TrustedUrlPrefixes.Keys)
        {
            if (TryCreateAbsolute(trustedPrefix, out var prefixUri)
                && prefixUri is not null
                && IsTrustedPrefixMatch(metadataUri, prefixUri, trustedPrefix))
            {
                return true;
            }
        }

        if (TryGetGithubOwnerAndRepository(metadataUri, out var owner, out var repository))
        {
            if (policy.OfficialGithubRepositories.Contains(repository, StringComparer.OrdinalIgnoreCase)
                || policy.OfficialGithubOrganizations.Contains(owner, StringComparer.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static bool OverlapsWithLegacyEntry(TrustedProjectSourcePolicy policy, TrustedMintSourceRegistryEntry legacyEntry)
    {
        if (legacyEntry.CanonicalDomains.Any(domain => policy.OfficialDomains.Contains(domain, StringComparer.OrdinalIgnoreCase)))
        {
            return true;
        }

        if (legacyEntry.OfficialGithubRepositories.Any(repo => policy.OfficialGithubRepositories.Contains(repo, StringComparer.OrdinalIgnoreCase)))
        {
            return true;
        }

        if (legacyEntry.TrustedUrlPrefixes.Keys.Any(prefix => policy.TrustedUrlPrefixes.ContainsKey(prefix)))
        {
            return true;
        }

        return false;
    }

    private static bool TryCreateAbsolute(string uriText, out Uri? uri)
    {
        return Uri.TryCreate(uriText, UriKind.Absolute, out uri);
    }

    private static bool IsTrustedPrefixMatch(Uri finalUri, Uri prefixUri, string trustedPrefix)
    {
        if (!string.Equals(finalUri.Scheme, prefixUri.Scheme, StringComparison.OrdinalIgnoreCase)
            || !string.Equals(finalUri.Host, prefixUri.Host, StringComparison.OrdinalIgnoreCase)
            || finalUri.Port != prefixUri.Port)
        {
            return false;
        }

        var normalizedPrefixPath = NormalizePath(prefixUri.AbsolutePath);
        var normalizedFinalPath = NormalizePath(finalUri.AbsolutePath);
        var prefixIsDirectory = trustedPrefix.EndsWith("/", StringComparison.Ordinal);

        return prefixIsDirectory
            ? normalizedFinalPath.StartsWith(normalizedPrefixPath, StringComparison.Ordinal)
            : string.Equals(normalizedFinalPath, normalizedPrefixPath, StringComparison.Ordinal);
    }

    private static bool TryGetGithubOwnerAndRepository(Uri uri, out string owner, out string repository)
    {
        owner = string.Empty;
        repository = string.Empty;

        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (uri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase))
        {
            if (segments.Length < 2)
            {
                return false;
            }

            owner = segments[0];
            repository = $"{segments[0]}/{segments[1]}";
            return true;
        }

        if (uri.Host.Equals("raw.githubusercontent.com", StringComparison.OrdinalIgnoreCase))
        {
            if (segments.Length < 3)
            {
                return false;
            }

            owner = segments[0];
            repository = $"{segments[0]}/{segments[1]}";
            return true;
        }

        return false;
    }

    private static string? NormalizeHost(string host)
    {
        if (string.IsNullOrWhiteSpace(host))
        {
            return null;
        }

        try
        {
            var idn = new IdnMapping();
            return idn.GetAscii(host).ToLowerInvariant();
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private static string NormalizePath(string absolutePath)
    {
        var trailingSlash = absolutePath.EndsWith("/", StringComparison.Ordinal);
        var compact = absolutePath;

        while (compact.Contains("//", StringComparison.Ordinal))
        {
            compact = compact.Replace("//", "/", StringComparison.Ordinal);
        }

        if (compact.Length > 1 && compact.EndsWith("/", StringComparison.Ordinal) && !trailingSlash)
        {
            compact = compact.TrimEnd('/');
        }

        return compact;
    }
}
