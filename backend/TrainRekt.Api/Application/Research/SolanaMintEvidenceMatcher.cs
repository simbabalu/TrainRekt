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

    private static bool HasBoundaryAwareExactMatch(string mint, string text)
    {
        var escaped = Regex.Escape(mint);
        var pattern = $"(?<![1-9A-HJ-NP-Za-km-z]){escaped}(?![1-9A-HJ-NP-Za-km-z])";
        return Regex.IsMatch(text, pattern, RegexOptions.CultureInvariant);
    }
}
