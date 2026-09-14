using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

public sealed class AiSafetyCoachResponseValidator
{
    private static readonly Regex SentenceTerminator = new(
        "[.!?]+(?=\\s|$)",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly HashSet<string> AllowedTrainingTopics =
    [
        "token-account-state",
        "delegated-authority",
        "token-2022",
        "empty-token-account"
    ];

    private static readonly Regex ProhibitedLanguage = new(
        "\\b(safe|scam|buy|sell|entry|exit|price target|guaranteed return|expected return|profit target|sign this|approve this wallet|approve this transaction|send transaction|submit transaction|execute transaction)\\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private static readonly Regex ProhibitedIdentityVerdicts = new(
        "\\b(confirmed copycat|definitely\\s+(a\\s+)?copycat|definitely\\s+(a\\s+)?fake|definitely\\s+(a\\s+)?scam|this\\s+is\\s+the\\s+original|this\\s+token\\s+is\\s+authentic|copying\\s+intent\\s+is\\s+proven|malicious\\s+intent\\s+is\\s+proven)\\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private readonly AiSafetyCoachOptions _options;

    public AiSafetyCoachResponseValidator(IOptions<AiSafetyCoachOptions> options)
    {
        _options = options.Value;
    }

    public bool TryValidate(AiSafetyCoachContent content, out string reason)
    {
        reason = string.Empty;
        var summaryDiagnostics = DescribeSummary(content);

        if (summaryDiagnostics.IsEmpty)
        {
            reason = "Summary is missing.";
            return false;
        }

        if (summaryDiagnostics.Length > summaryDiagnostics.MaxLength)
        {
            reason = "Summary exceeds max length.";
            return false;
        }

        if (summaryDiagnostics.Sentences > _options.MaxSummarySentences)
        {
            reason = "Summary exceeds max sentence count.";
            return false;
        }

        if (!ValidateList(content.RiskExplanations, _options.MaxRiskExplanations, "riskExplanations", out reason))
        {
            return false;
        }

        if (!ValidateList(content.WhatToCheckNext, _options.MaxWhatToCheckNext, "whatToCheckNext", out reason))
        {
            return false;
        }

        if (!ValidateList(content.Uncertainty, _options.MaxUncertaintyItems, "uncertainty", out reason))
        {
            return false;
        }

        if (content.RecommendedTrainingTopicId is not null
            && !AllowedTrainingTopics.Contains(content.RecommendedTrainingTopicId))
        {
            reason = "Unsupported recommended training topic.";
            return false;
        }

        var combined = string.Join(
            "\n",
            new[] { content.Summary }
                .Concat(content.RiskExplanations)
                .Concat(content.WhatToCheckNext)
                .Concat(content.Uncertainty));

        if (ProhibitedLanguage.IsMatch(combined))
        {
            reason = "Coach output contained prohibited guidance or verdict language.";
            return false;
        }

        if (ProhibitedIdentityVerdicts.IsMatch(combined))
        {
            reason = "Coach output contained prohibited identity verdict assertions.";
            return false;
        }

        return true;
    }

    public AiSafetyCoachSummaryValidationDiagnostics DescribeSummary(AiSafetyCoachContent content)
    {
        var summary = content.Summary;
        var isEmpty = string.IsNullOrWhiteSpace(summary);
        var normalized = summary ?? string.Empty;
        var length = normalized.Length;
        var sentenceCount = CountSentences(normalized);

        return new AiSafetyCoachSummaryValidationDiagnostics(
            length,
            _options.MaxSummaryLength,
            sentenceCount,
            isEmpty);
    }

    private bool ValidateList(IReadOnlyList<string> values, int maxItems, string fieldName, out string reason)
    {
        reason = string.Empty;
        if (values.Count > maxItems)
        {
            reason = $"List exceeds max item count for {fieldName}.";
            return false;
        }

        foreach (var value in values)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > _options.MaxListItemLength)
            {
                reason = $"List contains invalid or oversized item for {fieldName}.";
                return false;
            }
        }

        return true;
    }

    private static int CountSentences(string text)
    {
        var count = SentenceTerminator.Matches(text).Count;
        if (count > 0)
        {
            return count;
        }

        return string.IsNullOrWhiteSpace(text) ? 0 : 1;
    }
}

public readonly record struct AiSafetyCoachSummaryValidationDiagnostics(
    int Length,
    int MaxLength,
    int Sentences,
    bool IsEmpty);