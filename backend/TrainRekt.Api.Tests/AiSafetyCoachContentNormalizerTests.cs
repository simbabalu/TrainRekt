using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;

namespace TrainRekt.Api.Tests;

public sealed class AiSafetyCoachContentNormalizerTests
{
    [Fact]
    public void Normalize_RiskItemAtLimit_RemainsUnchanged()
    {
        var options = CreateOptions(maxListItemLength: 32);
        var normalizer = CreateNormalizer(options);
        var itemAtLimit = new string('a', 32);
        var content = CreateContent(
            risk: new[] { itemAtLimit },
            next: new[] { "Check docs" },
            uncertainty: new[] { "Context incomplete" });

        var result = normalizer.Normalize(content);

        Assert.Equal(itemAtLimit, Assert.Single(result.Content.RiskExplanations));
        Assert.DoesNotContain(result.Events, evt => evt.Section == "riskExplanations");
    }

    [Fact]
    public void Normalize_RiskItemSlightlyOverLimit_IsShortenedAndAcceptedByValidator()
    {
        var options = CreateOptions(maxListItemLength: 44);
        var normalizer = CreateNormalizer(options);
        var validator = CreateValidator(options);
        var overLimit = "Active authority can mint additional supply if controls are used.";
        var content = CreateContent(risk: new[] { overLimit });

        var result = normalizer.Normalize(content);
        var normalizedRisk = Assert.Single(result.Content.RiskExplanations);

        Assert.True(overLimit.Length > options.MaxListItemLength);
        Assert.True(normalizedRisk.Length <= options.MaxListItemLength);
        Assert.True(validator.TryValidate(result.Content, out _));
        Assert.Contains(result.Events, evt => evt.Section == "riskExplanations");
    }

    [Fact]
    public void Normalize_VeryLongItem_IsBoundedToConfiguredLength()
    {
        var options = CreateOptions(maxListItemLength: 50);
        var normalizer = CreateNormalizer(options);
        var veryLong = string.Join(' ', Enumerable.Repeat("longword", 50));
        var content = CreateContent(risk: new[] { veryLong });

        var result = normalizer.Normalize(content);
        var normalizedRisk = Assert.Single(result.Content.RiskExplanations);

        Assert.True(normalizedRisk.Length <= options.MaxListItemLength);
    }

    [Fact]
    public void Normalize_OverLimit_PrefersWordBoundary()
    {
        var options = CreateOptions(maxListItemLength: 34);
        var normalizer = CreateNormalizer(options);
        var item = "Token concentration remains high and can amplify volatility quickly.";
        var content = CreateContent(risk: new[] { item });

        var result = normalizer.Normalize(content);
        var normalizedRisk = Assert.Single(result.Content.RiskExplanations);

        Assert.Equal("Token concentration remains...", normalizedRisk);
    }

    [Fact]
    public void Normalize_OverLimit_DoesNotEndWithBrokenWord()
    {
        var options = CreateOptions(maxListItemLength: 36);
        var normalizer = CreateNormalizer(options);
        var item = "Freeze authority is active so transfer behavior can still change.";
        var content = CreateContent(risk: new[] { item });

        var result = normalizer.Normalize(content);
        var normalizedRisk = Assert.Single(result.Content.RiskExplanations);

        Assert.False(normalizedRisk.EndsWith("chang", StringComparison.Ordinal));
        Assert.False(normalizedRisk.EndsWith("change", StringComparison.Ordinal));
        Assert.EndsWith("...", normalizedRisk, StringComparison.Ordinal);
    }

    [Fact]
    public void Normalize_WhatToCheckNext_UsesSameNormalizationRules()
    {
        var options = CreateOptions(maxListItemLength: 40);
        var normalizer = CreateNormalizer(options);
        var item = "Confirm official docs still reference this exact mint and governance controls.";
        var content = CreateContent(next: new[] { item });

        var result = normalizer.Normalize(content);
        var normalized = Assert.Single(result.Content.WhatToCheckNext);

        Assert.True(normalized.Length <= options.MaxListItemLength);
        Assert.Contains(result.Events, evt => evt.Section == "whatToCheckNext");
    }

    [Fact]
    public void Normalize_Uncertainty_UsesSameNormalizationRules()
    {
        var options = CreateOptions(maxListItemLength: 38);
        var normalizer = CreateNormalizer(options);
        var item = "Context can explain controls but cannot prove controls are safely operated.";
        var content = CreateContent(uncertainty: new[] { item });

        var result = normalizer.Normalize(content);
        var normalized = Assert.Single(result.Content.Uncertainty);

        Assert.True(normalized.Length <= options.MaxListItemLength);
        Assert.Contains(result.Events, evt => evt.Section == "uncertainty");
    }

    [Fact]
    public void Normalize_EmptyListItem_StillFailsValidation()
    {
        var options = CreateOptions(maxListItemLength: 40);
        var normalizer = CreateNormalizer(options);
        var validator = CreateValidator(options);
        var content = CreateContent(risk: new[] { "   " });

        var result = normalizer.Normalize(content);

        Assert.False(validator.TryValidate(result.Content, out var reason));
        Assert.Equal("List contains invalid or oversized item for riskExplanations.", reason);
    }

    [Fact]
    public void Normalize_ExcessListCount_StillFailsValidation()
    {
        var options = CreateOptions(maxListItemLength: 40, maxRiskExplanations: 3);
        var normalizer = CreateNormalizer(options);
        var validator = CreateValidator(options);
        var content = CreateContent(risk: new[] { "one", "two", "three", "four" });

        var result = normalizer.Normalize(content);

        Assert.False(validator.TryValidate(result.Content, out var reason));
        Assert.Equal("List exceeds max item count for riskExplanations.", reason);
    }

    [Fact]
    public void Normalize_DoesNotChangeSummaryBehavior()
    {
        var options = CreateOptions(maxListItemLength: 30, maxSummaryLength: 20, maxSummarySentences: 2);
        var normalizer = CreateNormalizer(options);
        var validator = CreateValidator(options);
        var content = CreateContent(
            summary: new string('s', 21),
            risk: new[] { "Risk explanation with many words to be shortened." });

        var result = normalizer.Normalize(content);

        Assert.Equal(content.Summary, result.Content.Summary);
        Assert.False(validator.TryValidate(result.Content, out var reason));
        Assert.Equal("Summary exceeds max length.", reason);
    }

    [Fact]
    public void Normalize_CollapsesRepeatedWhitespaceAndTrims()
    {
        var options = CreateOptions(maxListItemLength: 80);
        var normalizer = CreateNormalizer(options);
        var content = CreateContent(risk: new[] { "  Active\n\t mint   authority   remains.  " });

        var result = normalizer.Normalize(content);
        var normalizedRisk = Assert.Single(result.Content.RiskExplanations);

        Assert.Equal("Active mint authority remains.", normalizedRisk);
        Assert.Contains(result.Events, evt => evt.Section == "riskExplanations");
    }

    [Fact]
    public void Normalize_OutputSatisfiesValidatorWhenOnlyIssueIsOverlengthListItems()
    {
        var options = CreateOptions(maxListItemLength: 42);
        var normalizer = CreateNormalizer(options);
        var validator = CreateValidator(options);
        var content = CreateContent(
            risk: new[] { "Active authority can expand supply and shift holder risk assumptions quickly." },
            next: new[] { "Confirm issuer docs still map to this exact mint and authority model." },
            uncertainty: new[] { "Context can explain why controls exist but not prove safe control operation." });

        var result = normalizer.Normalize(content);

        Assert.True(validator.TryValidate(result.Content, out _));
    }

    private static AiSafetyCoachContentNormalizer CreateNormalizer(AiSafetyCoachOptions options)
    {
        return new AiSafetyCoachContentNormalizer(Options.Create(options));
    }

    private static AiSafetyCoachResponseValidator CreateValidator(AiSafetyCoachOptions options)
    {
        return new AiSafetyCoachResponseValidator(Options.Create(options));
    }

    private static AiSafetyCoachOptions CreateOptions(
        int maxListItemLength,
        int maxRiskExplanations = 3,
        int maxSummaryLength = 320,
        int maxSummarySentences = 2)
    {
        return new AiSafetyCoachOptions
        {
            Enabled = true,
            Language = "en",
            MaxListItemLength = maxListItemLength,
            MaxRiskExplanations = maxRiskExplanations,
            MaxWhatToCheckNext = 2,
            MaxUncertaintyItems = 2,
            MaxSummaryLength = maxSummaryLength,
            MaxSummarySentences = maxSummarySentences
        };
    }

    private static AiSafetyCoachContent CreateContent(
        string summary = "Deterministic findings indicate active controls requiring review.",
        IReadOnlyList<string>? risk = null,
        IReadOnlyList<string>? next = null,
        IReadOnlyList<string>? uncertainty = null)
    {
        return new AiSafetyCoachContent(
            summary,
            risk ?? new[] { "Active authority remains a control risk." },
            next ?? new[] { "Confirm official docs reference this exact mint." },
            uncertainty ?? new[] { "Context does not prove safety." },
            null);
    }
}