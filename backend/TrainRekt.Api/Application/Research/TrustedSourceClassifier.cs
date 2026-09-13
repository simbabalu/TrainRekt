using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public sealed record TrustedSourceDecision(
    bool IsTrusted,
    ResearchSourceType? EffectiveType,
    bool IsCanonicalProjectWebsite);

public sealed class TrustedSourceClassifier
{
    public TrustedSourceDecision Classify(TrustedMintSourceRegistryEntry? registryEntry, Uri finalUri, string? normalizedHost)
    {
        if (registryEntry is null || string.IsNullOrWhiteSpace(normalizedHost))
        {
            return new TrustedSourceDecision(false, null, false);
        }

        foreach (var prefix in registryEntry.TrustedUrlPrefixes.OrderByDescending(entry => entry.Key.Length))
        {
            if (IsTrustedPrefixMatch(finalUri, prefix.Key))
            {
                var isCanonical = prefix.Value == ResearchSourceType.ProjectWebsite
                    || registryEntry.CanonicalDomains.Contains(normalizedHost, StringComparer.OrdinalIgnoreCase);

                return new TrustedSourceDecision(true, prefix.Value, isCanonical);
            }
        }

        if (TryGetGithubRepository(finalUri, out var repository)
            && registryEntry.OfficialGithubRepositories.Contains(repository, StringComparer.OrdinalIgnoreCase))
        {
            return new TrustedSourceDecision(true, ResearchSourceType.OfficialRepository, false);
        }

        if (registryEntry.CanonicalDomains.Contains(normalizedHost, StringComparer.OrdinalIgnoreCase))
        {
            return new TrustedSourceDecision(true, ResearchSourceType.ProjectWebsite, true);
        }

        return new TrustedSourceDecision(false, null, false);
    }

    private static bool IsTrustedPrefixMatch(Uri finalUri, string trustedPrefix)
    {
        if (!Uri.TryCreate(trustedPrefix, UriKind.Absolute, out var prefixUri))
        {
            return false;
        }

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

    public static bool TryGetGithubRepository(Uri uri, out string repository)
    {
        repository = string.Empty;

        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (uri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase))
        {
            if (segments.Length < 2)
            {
                return false;
            }

            repository = $"{segments[0]}/{segments[1]}";
            return true;
        }

        if (uri.Host.Equals("raw.githubusercontent.com", StringComparison.OrdinalIgnoreCase))
        {
            if (segments.Length < 3)
            {
                return false;
            }

            repository = $"{segments[0]}/{segments[1]}";
            return true;
        }

        return false;
    }
}
