using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

public sealed record AiSafetyCoachListNormalizationEvent(
    string Section,
    int OriginalLength,
    int NormalizedLength);

public sealed record AiSafetyCoachContentNormalizationResult(
    AiSafetyCoachContent Content,
    IReadOnlyList<AiSafetyCoachListNormalizationEvent> Events);

public sealed class AiSafetyCoachContentNormalizer
{
    private static readonly Regex MultiWhitespace = new(
        "\\s+",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private const string Ellipsis = "...";

    private readonly AiSafetyCoachOptions _options;

    public AiSafetyCoachContentNormalizer(IOptions<AiSafetyCoachOptions> options)
    {
        _options = options.Value;
    }

    public AiSafetyCoachContentNormalizationResult Normalize(AiSafetyCoachContent content)
    {
        var events = new List<AiSafetyCoachListNormalizationEvent>();

        var riskExplanations = NormalizeList("riskExplanations", content.RiskExplanations, events);
        var whatToCheckNext = NormalizeList("whatToCheckNext", content.WhatToCheckNext, events);
        var uncertainty = NormalizeList("uncertainty", content.Uncertainty, events);

        var normalized = new AiSafetyCoachContent(
            content.Summary,
            riskExplanations,
            whatToCheckNext,
            uncertainty,
            content.RecommendedTrainingTopicId);

        return new AiSafetyCoachContentNormalizationResult(normalized, events);
    }

    private IReadOnlyList<string> NormalizeList(
        string section,
        IReadOnlyList<string> values,
        List<AiSafetyCoachListNormalizationEvent> events)
    {
        var normalized = new string[values.Count];
        var maxLength = Math.Max(1, _options.MaxListItemLength);

        for (var index = 0; index < values.Count; index++)
        {
            var value = values[index] ?? string.Empty;
            var normalizedItem = NormalizeItem(value, maxLength);
            normalized[index] = normalizedItem;

            if (!string.Equals(value, normalizedItem, StringComparison.Ordinal))
            {
                events.Add(new AiSafetyCoachListNormalizationEvent(section, value.Length, normalizedItem.Length));
            }
        }

        return normalized;
    }

    private static string NormalizeItem(string value, int maxLength)
    {
        var trimmed = value.Trim();
        var compact = CollapseWhitespace(trimmed);

        if (compact.Length <= maxLength)
        {
            return compact;
        }

        return ShortenToBound(compact, maxLength);
    }

    private static string CollapseWhitespace(string value)
    {
        if (value.Length == 0)
        {
            return value;
        }

        return MultiWhitespace.Replace(value, " ");
    }

    private static string ShortenToBound(string value, int maxLength)
    {
        if (maxLength <= 0)
        {
            return string.Empty;
        }

        if (value.Length <= maxLength)
        {
            return value;
        }

        var allowEllipsis = maxLength > Ellipsis.Length;
        var prefixBudget = allowEllipsis ? maxLength - Ellipsis.Length : maxLength;
        var prefix = value[..prefixBudget].TrimEnd();

        if (prefix.Length == 0)
        {
            return allowEllipsis ? Ellipsis : value[..maxLength];
        }

        if (EndsWithBrokenWord(value, prefix.Length, prefix))
        {
            var boundaryIndex = FindLastBoundary(prefix);
            if (boundaryIndex > 0)
            {
                prefix = prefix[..boundaryIndex].TrimEnd();
            }
            else
            {
                return allowEllipsis ? Ellipsis : value[..maxLength];
            }
        }

        if (allowEllipsis && prefix.Length + Ellipsis.Length <= maxLength)
        {
            return prefix + Ellipsis;
        }

        return prefix.Length <= maxLength ? prefix : prefix[..maxLength];
    }

    private static bool EndsWithBrokenWord(string original, int cutIndex, string prefix)
    {
        if (cutIndex <= 0 || cutIndex >= original.Length || prefix.Length == 0)
        {
            return false;
        }

        return IsWordChar(prefix[^1]) && IsWordChar(original[cutIndex]);
    }

    private static int FindLastBoundary(string value)
    {
        for (var index = value.Length - 1; index >= 0; index--)
        {
            var ch = value[index];
            if (char.IsWhiteSpace(ch))
            {
                return index;
            }

            if (!IsWordChar(ch))
            {
                return index + 1;
            }
        }

        return -1;
    }

    private static bool IsWordChar(char value)
    {
        return char.IsLetterOrDigit(value);
    }
}