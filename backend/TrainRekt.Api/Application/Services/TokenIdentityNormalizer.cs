using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenIdentityNormalizer
{
    private static readonly Regex UrlLikeRegex = new(@"\b(?:https?://|www\.)\S+", RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    private static readonly Regex CollapseWhitespaceRegex = new(@"\s+", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public string? NormalizeName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().Normalize(NormalizationForm.FormKC);
        normalized = UrlLikeRegex.Replace(normalized, " ");

        var builder = new StringBuilder(normalized.Length);
        foreach (var rune in normalized.EnumerateRunes())
        {
            if (Rune.IsLetterOrDigit(rune))
            {
                builder.Append(rune.ToString().ToLowerInvariant());
                continue;
            }

            if (Rune.IsWhiteSpace(rune)
                || Rune.GetUnicodeCategory(rune) is UnicodeCategory.ConnectorPunctuation
                    or UnicodeCategory.DashPunctuation
                    or UnicodeCategory.OpenPunctuation
                    or UnicodeCategory.ClosePunctuation
                    or UnicodeCategory.InitialQuotePunctuation
                    or UnicodeCategory.FinalQuotePunctuation
                    or UnicodeCategory.OtherPunctuation
                    or UnicodeCategory.MathSymbol
                    or UnicodeCategory.CurrencySymbol
                    or UnicodeCategory.ModifierSymbol
                    or UnicodeCategory.OtherSymbol)
            {
                builder.Append(' ');
            }
        }

        var collapsed = CollapseWhitespaceRegex.Replace(builder.ToString().Trim(), " ");
        return string.IsNullOrWhiteSpace(collapsed) ? null : collapsed;
    }

    public string? NormalizeSymbol(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().Normalize(NormalizationForm.FormKC);
        if (normalized.StartsWith('$'))
        {
            normalized = normalized[1..];
        }

        var builder = new StringBuilder(normalized.Length);
        foreach (var rune in normalized.EnumerateRunes())
        {
            if (Rune.IsLetterOrDigit(rune))
            {
                builder.Append(rune.ToString().ToLowerInvariant());
                continue;
            }

            if (Rune.IsWhiteSpace(rune)
                || Rune.GetUnicodeCategory(rune) is UnicodeCategory.ConnectorPunctuation
                    or UnicodeCategory.DashPunctuation
                    or UnicodeCategory.OtherPunctuation)
            {
                continue;
            }
        }

        var collapsed = builder.ToString().Trim();
        return string.IsNullOrWhiteSpace(collapsed) ? null : collapsed;
    }
}
