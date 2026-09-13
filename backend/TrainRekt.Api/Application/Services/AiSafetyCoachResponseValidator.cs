using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

public sealed class AiSafetyCoachResponseValidator
{
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

    private readonly AiSafetyCoachOptions _options;

    public AiSafetyCoachResponseValidator(IOptions<AiSafetyCoachOptions> options)
    {
        _options = options.Value;
    }

    public bool TryValidate(AiSafetyCoachContent content, out string reason)
    {
        reason = string.Empty;

        if (string.IsNullOrWhiteSpace(content.Summary) || content.Summary.Length > _options.MaxSummaryLength)
        {
            reason = "Summary is missing or exceeds max length.";
            return false;
        }

        if (!ValidateList(content.RiskExplanations, _options.MaxRiskExplanations, out reason))
        {
            return false;
        }

        if (!ValidateList(content.WhatToCheckNext, _options.MaxWhatToCheckNext, out reason))
        {
            return false;
        }

        if (!ValidateList(content.Uncertainty, _options.MaxUncertaintyItems, out reason))
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

        return true;
    }

    private bool ValidateList(IReadOnlyList<string> values, int maxItems, out string reason)
    {
        reason = string.Empty;
        if (values.Count > maxItems)
        {
            reason = "List exceeds max item count.";
            return false;
        }

        foreach (var value in values)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > _options.MaxListItemLength)
            {
                reason = "List contains invalid or oversized item.";
                return false;
            }
        }

        return true;
    }
}