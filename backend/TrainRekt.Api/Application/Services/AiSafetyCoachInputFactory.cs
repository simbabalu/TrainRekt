using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class AiSafetyCoachInputFactory
{
    private readonly AiSafetyCoachOptions _options;

    public AiSafetyCoachInputFactory(IOptions<AiSafetyCoachOptions> options)
    {
        _options = options.Value;
    }

    public AiSafetyCoachInput Create(TokenInspection inspection)
    {
        var protocols = BuildProtocolBreakdown(inspection);
        var reviewSignals = BuildReviewSignals(inspection.ReviewSignals);
        var claimSummaries = BuildClaimSummaries(inspection.ProtocolContext);
        var uncertaintyMarkers = BuildUncertaintyMarkers(inspection, claimSummaries);

        return new AiSafetyCoachInput(
            TokenName: Truncate(inspection.Identity.Name),
            TokenSymbol: Truncate(inspection.Identity.Symbol),
            TokenProgram: Truncate(inspection.Program.ProgramType) ?? "unknown",
            Age: new AiSafetyCoachAgeInput(
                AgeSeconds: inspection.Age.AgeSeconds,
                IsReliable: inspection.Age.IsReliable,
                UnavailableReason: Truncate(inspection.Age.UnavailableReason)),
            Authorities: new AiSafetyCoachAuthorityInput(
                MintAuthorityRevoked: inspection.Authorities.MintAuthorityRevoked,
                FreezeAuthorityRevoked: inspection.Authorities.FreezeAuthorityRevoked),
            Concentration: new AiSafetyCoachConcentrationInput(
                TopHolderPercentage: inspection.HolderConcentration.TopHolderPercentage,
                Top5HoldersPercentage: inspection.HolderConcentration.Top5HoldersPercentage,
                Top10HoldersPercentage: inspection.HolderConcentration.Top10HoldersPercentage,
                SemanticsNote: Truncate(inspection.HolderConcentration.SemanticsNote) ?? string.Empty,
                ClassifiedProtocolPercentage: inspection.HolderConcentration.UnclassifiedTokenAccountConcentration?.ClassifiedProtocolPercentage,
                UnknownPercentageWithinReportedLargestAccounts: inspection.HolderConcentration.UnclassifiedTokenAccountConcentration?.UnknownPercentageWithinReportedLargestAccounts,
                LargestUnknownTokenAccountPercentage: inspection.HolderConcentration.UnclassifiedTokenAccountConcentration?.LargestUnknownTokenAccountPercentage,
                Top5UnknownTokenAccountsPercentage: inspection.HolderConcentration.UnclassifiedTokenAccountConcentration?.Top5UnknownTokenAccountsPercentage,
                UnclassifiedSemanticsNote: Truncate(inspection.HolderConcentration.UnclassifiedTokenAccountConcentration?.SemanticsNote)),
            ProtocolBreakdown: protocols,
            DeterministicStatus: inspection.ProtocolContext is null ? "deterministic-only" : "deterministic-with-trusted-context",
            ReviewSignals: reviewSignals,
            TrustedClaimSummaries: claimSummaries,
            UncertaintyMarkers: uncertaintyMarkers);
    }

    private IReadOnlyList<AiSafetyCoachProtocolBreakdownItem> BuildProtocolBreakdown(TokenInspection inspection)
    {
        var items = inspection.LargestTokenAccounts
            .Where(account => !string.IsNullOrWhiteSpace(account.Classification.Protocol))
            .GroupBy(
                account => new
                {
                    Protocol = account.Classification.Protocol!,
                    Role = account.Classification.Classification,
                    Confidence = account.Classification.Confidence
                })
            .Select(group => new AiSafetyCoachProtocolBreakdownItem(
                Protocol: Truncate(group.Key.Protocol) ?? string.Empty,
                Role: Truncate(group.Key.Role) ?? string.Empty,
                Confidence: Truncate(group.Key.Confidence) ?? string.Empty,
                Percentage: group.Sum(entry => entry.Percentage ?? 0m),
                AccountCount: group.Count()))
            .OrderBy(item => item.Protocol, StringComparer.Ordinal)
            .ThenBy(item => item.Role, StringComparer.Ordinal)
            .ThenBy(item => item.Confidence, StringComparer.Ordinal)
            .Take(_options.MaxProtocolBreakdownItems)
            .ToArray();

        return items;
    }

    private IReadOnlyList<AiSafetyCoachReviewSignalInput> BuildReviewSignals(IReadOnlyList<TokenReviewSignal> signals)
    {
        return signals
            .OrderBy(signal => signal.Id, StringComparer.Ordinal)
            .Take(_options.MaxReviewSignals)
            .Select(signal => new AiSafetyCoachReviewSignalInput(
                Id: Truncate(signal.Id) ?? string.Empty,
                Category: Truncate(signal.Category) ?? string.Empty,
                Severity: Truncate(signal.Severity) ?? string.Empty,
                Explanation: Truncate(signal.Explanation) ?? string.Empty,
                Evidence: signal.Evidence
                    .OrderBy(entry => entry.Key, StringComparer.Ordinal)
                    .Take(_options.MaxEvidencePerSignal)
                    .Select(entry => new AiSafetyCoachEvidencePair(
                        Key: Truncate(entry.Key) ?? string.Empty,
                        Value: Truncate(entry.Value) ?? string.Empty))
                    .ToArray()))
            .ToArray();
    }

    private IReadOnlyList<AiSafetyCoachClaimSummaryInput> BuildClaimSummaries(ProtocolResearchContext? context)
    {
        if (context is null)
        {
            return Array.Empty<AiSafetyCoachClaimSummaryInput>();
        }

        var sourcePublishers = context.Sources
            .ToDictionary(source => source.Id, source => Truncate(source.Publisher) ?? string.Empty, StringComparer.Ordinal);

        return context.Claims
            .OrderBy(claim => claim.Id, StringComparer.Ordinal)
            .Take(_options.MaxClaimSummaries)
            .Select(claim => new AiSafetyCoachClaimSummaryInput(
                Id: Truncate(claim.Id) ?? string.Empty,
                Category: Truncate(claim.Category) ?? string.Empty,
                Statement: Truncate(claim.Statement) ?? string.Empty,
                VerificationStatus: claim.VerificationStatus,
                VerificationMethod: claim.VerificationMethod,
                Consistency: claim.Consistency,
                SourceCount: claim.SourceIds.Count,
                SourcePublishers: claim.SourceIds
                    .Distinct(StringComparer.Ordinal)
                    .Select(sourceId => sourcePublishers.TryGetValue(sourceId, out var publisher) ? publisher : "unknown")
                    .Take(_options.MaxSourcesPerClaim)
                    .OrderBy(publisher => publisher, StringComparer.Ordinal)
                    .ToArray()))
            .ToArray();
    }

    private IReadOnlyList<string> BuildUncertaintyMarkers(
        TokenInspection inspection,
        IReadOnlyList<AiSafetyCoachClaimSummaryInput> claimSummaries)
    {
        var markers = new List<string>();

        if (!inspection.Age.IsReliable)
        {
            markers.Add("token_age_unreliable");
        }

        if (inspection.HolderConcentration.TopHolderPercentage is null)
        {
            markers.Add("top_holder_concentration_unavailable");
        }

        if (inspection.HolderConcentration.UnclassifiedTokenAccountConcentration?.UnknownPercentageWithinReportedLargestAccounts is > 0m)
        {
            markers.Add("largest_accounts_include_unknown_classification");
        }

        if (claimSummaries.Any(claim => claim.Consistency == ObservedConsistency.Conflict))
        {
            markers.Add("trusted_claim_consistency_conflict");
        }

        return markers
            .Distinct(StringComparer.Ordinal)
            .OrderBy(marker => marker, StringComparer.Ordinal)
            .Take(_options.MaxUncertaintyItems)
            .ToArray();
    }

    private string? Truncate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        var max = Math.Max(1, _options.MaxListItemLength);
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}