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
        return Classify(registryEntry, null, finalUri, normalizedHost);
    }

    public TrustedSourceDecision Classify(
        TrustedMintSourceRegistryEntry? registryEntry,
        TrustedProjectSourcePolicy? projectPolicy,
        Uri finalUri,
        string? normalizedHost)
    {
        if (registryEntry is null && projectPolicy is null)
        {
            return new TrustedSourceDecision(false, null, false);
        }

        if (string.IsNullOrWhiteSpace(normalizedHost))
        {
            return new TrustedSourceDecision(false, null, false);
        }

        var trustedPrefixes = new List<KeyValuePair<string, ResearchSourceType>>();
        if (projectPolicy is not null)
        {
            trustedPrefixes.AddRange(projectPolicy.TrustedUrlPrefixes);
        }

        if (registryEntry is not null)
        {
            trustedPrefixes.AddRange(registryEntry.TrustedUrlPrefixes);
        }

        foreach (var prefix in trustedPrefixes
                     .GroupBy(entry => entry.Key, StringComparer.Ordinal)
                     .Select(group => group.First())
                     .OrderByDescending(entry => entry.Key.Length))
        {
            if (IsTrustedPrefixMatch(finalUri, prefix.Key))
            {
                var isCanonical = prefix.Value == ResearchSourceType.ProjectWebsite
                    || IsCanonicalDomain(registryEntry, projectPolicy, normalizedHost);

                return new TrustedSourceDecision(true, prefix.Value, isCanonical);
            }
        }

        if (TryGetGithubOwnerAndRepository(finalUri, out var owner, out var repository)
            && (IsOfficialRepository(registryEntry, projectPolicy, repository)
                || IsOfficialGithubOrganization(projectPolicy, owner)))
        {
            return new TrustedSourceDecision(true, ResearchSourceType.OfficialRepository, false);
        }

        if (IsCanonicalDomain(registryEntry, projectPolicy, normalizedHost))
        {
            return new TrustedSourceDecision(true, ResearchSourceType.ProjectWebsite, true);
        }

        return new TrustedSourceDecision(false, null, false);
    }

    private static bool IsCanonicalDomain(
        TrustedMintSourceRegistryEntry? registryEntry,
        TrustedProjectSourcePolicy? projectPolicy,
        string normalizedHost)
    {
        var fromLegacy = registryEntry?.CanonicalDomains.Contains(normalizedHost, StringComparer.OrdinalIgnoreCase) == true;
        var fromProject = projectPolicy?.OfficialDomains.Contains(normalizedHost, StringComparer.OrdinalIgnoreCase) == true;
        return fromLegacy || fromProject;
    }

    private static bool IsOfficialRepository(
        TrustedMintSourceRegistryEntry? registryEntry,
        TrustedProjectSourcePolicy? projectPolicy,
        string repository)
    {
        var fromLegacy = registryEntry?.OfficialGithubRepositories.Contains(repository, StringComparer.OrdinalIgnoreCase) == true;
        var fromProject = projectPolicy?.OfficialGithubRepositories.Contains(repository, StringComparer.OrdinalIgnoreCase) == true;
        return fromLegacy || fromProject;
    }

    private static bool IsOfficialGithubOrganization(TrustedProjectSourcePolicy? projectPolicy, string owner)
    {
        return projectPolicy?.OfficialGithubOrganizations.Contains(owner, StringComparer.OrdinalIgnoreCase) == true;
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
}
