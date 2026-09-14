using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;

namespace TrainRekt.Api.Tests;

public sealed class AiSafetyCoachResponseValidatorTests
{
    [Fact]
    public void TryValidate_ValidContent_Passes()
    {
        var validator = CreateValidator();
        var content = CreateContent();

        var result = validator.TryValidate(content, out _);

        Assert.True(result);
    }

    [Fact]
    public void TryValidate_UnsupportedTopic_FailsClosed()
    {
        var validator = CreateValidator();
        var content = CreateContent() with { RecommendedTrainingTopicId = "unknown-topic" };

        var result = validator.TryValidate(content, out _);

        Assert.False(result);
    }

    [Fact]
    public void TryValidate_MissingSummary_FailsWithSpecificReason()
    {
        var validator = CreateValidator();
        var content = CreateContent() with { Summary = "   " };

        var result = validator.TryValidate(content, out var reason);

        Assert.False(result);
        Assert.Equal("Summary is missing.", reason);
    }

    [Fact]
    public void TryValidate_OverSummaryLength_FailsWithSpecificReason()
    {
        var validator = CreateValidator(new AiSafetyCoachOptions
        {
            MaxSummaryLength = 240,
            MaxSummarySentences = 2
        });
        var summary = $"{new string('a', 121)}. {new string('b', 121)}.";
        var content = CreateContent() with { Summary = summary };

        var result = validator.TryValidate(content, out var reason);

        Assert.False(result);
        Assert.Equal("Summary exceeds max length.", reason);
    }

    [Fact]
    public void TryValidate_TwoSentenceSummaryNearPracticalUpperBound_Passes()
    {
        var validator = CreateValidator(new AiSafetyCoachOptions
        {
            MaxSummaryLength = 320,
            MaxSummarySentences = 2
        });
        var summary = $"{new string('a', 150)}. {new string('b', 149)}.";
        Assert.True(summary.Length <= 320);
        var content = CreateContent() with { Summary = summary };

        var result = validator.TryValidate(content, out _);

        Assert.True(result);
    }

    [Theory]
    [InlineData("This token is safe.")]
    [InlineData("This is a scam.")]
    [InlineData("You should buy this.")]
    [InlineData("Best entry is now.")]
    [InlineData("Expected return is 20%.")]
    [InlineData("Sign this to continue.")]
    [InlineData("Approve this transaction to proceed.")]
    public void TryValidate_ProhibitedGuidanceOrVerdicts_FailsClosed(string summary)
    {
        var validator = CreateValidator();
        var content = CreateContent() with { Summary = summary };

        var result = validator.TryValidate(content, out _);

        Assert.False(result);
    }

    [Theory]
    [InlineData("This is a confirmed copycat token.")]
    [InlineData("Copying intent is proven by this evidence.")]
    [InlineData("This token is authentic and original.")]
    [InlineData("This is definitely a fake token.")]
    public void TryValidate_ProhibitedIdentityVerdicts_FailsClosed(string summary)
    {
        var validator = CreateValidator();
        var content = CreateContent() with { Summary = summary };

        var result = validator.TryValidate(content, out _);

        Assert.False(result);
    }

    [Fact]
    public void TryValidate_CautiousPossibleCopycatLanguage_Passes()
    {
        var validator = CreateValidator();
        var content = CreateContent() with
        {
            Summary = "Identity overlap can indicate a possible copycat pattern, but intent is not proven."
        };

        var result = validator.TryValidate(content, out _);

        Assert.True(result);
    }

    [Fact]
    public void TryValidate_OversizedListItem_Fails()
    {
        var validator = CreateValidator();
        var oversized = new string('x', 500);
        var content = CreateContent() with { RiskExplanations = new[] { oversized } };

        var result = validator.TryValidate(content, out _);

        Assert.False(result);
    }

    [Fact]
    public void TryValidate_SummaryWithTooManySentences_Fails()
    {
        var validator = CreateValidator();
        var content = CreateContent() with
        {
            Summary = "Authorities are active. Concentration is high. Identity evidence is incomplete."
        };

        var result = validator.TryValidate(content, out _);

        Assert.False(result);
    }

    [Fact]
    public void TryValidate_TooManyItems_Fails()
    {
        var validator = CreateValidator();
        var content = CreateContent() with
        {
            WhatToCheckNext = new[] { "a", "b", "c", "d", "e" }
        };

        var result = validator.TryValidate(content, out _);

        Assert.False(result);
    }

    [Fact]
    public void TryValidate_ContextualizedRiskItem_AboveOldLimitWithinNewLimit_Passes()
    {
        var validator = CreateValidator(new AiSafetyCoachOptions
        {
            MaxSummaryLength = 320,
            MaxSummarySentences = 2,
            MaxListItemLength = 150,
            MaxRiskExplanations = 3,
            MaxWhatToCheckNext = 2,
            MaxUncertaintyItems = 2
        });

        var contextualizedRisk = new string('r', 130);
        Assert.True(contextualizedRisk.Length > 90);
        Assert.True(contextualizedRisk.Length <= 150);
        var content = CreateContent() with { RiskExplanations = new[] { contextualizedRisk } };

        var result = validator.TryValidate(content, out _);

        Assert.True(result);
    }

    [Fact]
    public void TryValidate_ListItemBeyondNewLimit_Fails()
    {
        var validator = CreateValidator(new AiSafetyCoachOptions
        {
            MaxSummaryLength = 320,
            MaxSummarySentences = 2,
            MaxListItemLength = 150,
            MaxRiskExplanations = 3,
            MaxWhatToCheckNext = 2,
            MaxUncertaintyItems = 2
        });

        var oversized = new string('x', 151);
        var content = CreateContent() with { RiskExplanations = new[] { oversized } };

        var result = validator.TryValidate(content, out var reason);

        Assert.False(result);
        Assert.Equal("List contains invalid or oversized item for riskExplanations.", reason);
    }

    private static AiSafetyCoachResponseValidator CreateValidator(AiSafetyCoachOptions? options = null)
    {
        return new AiSafetyCoachResponseValidator(Options.Create(options ?? new AiSafetyCoachOptions()));
    }

    private static AiSafetyCoachContent CreateContent()
    {
        return new AiSafetyCoachContent(
            Summary: "This output explains technical signals and uncertainty.",
            RiskExplanations: new[] { "Active authority means future token behavior may change." },
            WhatToCheckNext: new[] { "Compare authority behavior with official docs." },
            Uncertainty: new[] { "Documentation can lag on-chain changes." },
            RecommendedTrainingTopicId: "token-account-state");
    }
}