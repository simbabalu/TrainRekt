using System.Text.RegularExpressions;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Application.Research;

public sealed record MintMatchResult(bool HasExactMintMatch, bool HasConflictingMintEvidence);

public sealed class SolanaMintEvidenceMatcher
{
    private static readonly Regex Base58TokenRegex = new("[1-9A-HJ-NP-Za-km-z]{32,44}", RegexOptions.Compiled);

    public MintMatchResult Match(
        string requestedMint,
        string normalizedText,
        IReadOnlyList<string> jsonMintFieldValues)
    {
        if (!SolanaPublicKeyValidator.TryNormalize(requestedMint, out var normalizedRequestedMint))
        {
            return new MintMatchResult(false, false);
        }

        var hasExact = HasBoundaryAwareExactMatch(normalizedRequestedMint, normalizedText);
        var hasConflicting = false;

        foreach (var value in jsonMintFieldValues)
        {
            if (!SolanaPublicKeyValidator.TryNormalize(value, out var normalizedValue))
            {
                continue;
            }

            if (string.Equals(normalizedValue, normalizedRequestedMint, StringComparison.Ordinal))
            {
                hasExact = true;
                continue;
            }

            hasConflicting = true;
        }

        if (!hasConflicting)
        {
            foreach (Match match in Base58TokenRegex.Matches(normalizedText))
            {
                if (!SolanaPublicKeyValidator.TryNormalize(match.Value, out var normalizedValue))
                {
                    continue;
                }

                if (!string.Equals(normalizedValue, normalizedRequestedMint, StringComparison.Ordinal))
                {
                    hasConflicting = true;
                    break;
                }
            }
        }

        return new MintMatchResult(hasExact, hasConflicting);
    }

    public IReadOnlyList<string> FindRelevantMintReferences(
        IReadOnlyList<string> relevantMints,
        string normalizedText,
        IReadOnlyList<string> jsonMintFieldValues,
        int maxBase58Candidates)
    {
        if (relevantMints.Count == 0)
        {
            return Array.Empty<string>();
        }

        var canonicalByMint = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var mint in relevantMints)
        {
            if (!SolanaPublicKeyValidator.TryNormalize(mint, out var normalizedMint))
            {
                continue;
            }

            canonicalByMint.TryAdd(normalizedMint, normalizedMint);
        }

        if (canonicalByMint.Count == 0)
        {
            return Array.Empty<string>();
        }

        var found = new HashSet<string>(StringComparer.Ordinal);

        foreach (var mint in canonicalByMint.Keys)
        {
            if (HasBoundaryAwareExactMatch(mint, normalizedText))
            {
                found.Add(mint);
            }
        }

        foreach (var value in jsonMintFieldValues)
        {
            if (!SolanaPublicKeyValidator.TryNormalize(value, out var normalizedValue))
            {
                continue;
            }

            if (canonicalByMint.ContainsKey(normalizedValue))
            {
                found.Add(normalizedValue);
            }
        }

        var candidatesExamined = 0;
        foreach (Match match in Base58TokenRegex.Matches(normalizedText))
        {
            if (candidatesExamined >= maxBase58Candidates)
            {
                break;
            }

            candidatesExamined += 1;

            if (!SolanaPublicKeyValidator.TryNormalize(match.Value, out var normalizedValue))
            {
                continue;
            }

            if (canonicalByMint.ContainsKey(normalizedValue))
            {
                found.Add(normalizedValue);
            }
        }

        return relevantMints
            .Where(mint => SolanaPublicKeyValidator.TryNormalize(mint, out var normalized) && found.Contains(normalized))
            .Select(mint => SolanaPublicKeyValidator.TryNormalize(mint, out var normalized) ? normalized : mint)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }

    private static bool HasBoundaryAwareExactMatch(string mint, string text)
    {
        var escaped = Regex.Escape(mint);
        var pattern = $"(?<![1-9A-HJ-NP-Za-km-z]){escaped}(?![1-9A-HJ-NP-Za-km-z])";
        return Regex.IsMatch(text, pattern, RegexOptions.CultureInvariant);
    }
}
