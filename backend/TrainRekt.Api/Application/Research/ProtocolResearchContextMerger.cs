using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public sealed record ProtocolResearchMergeResult(ProtocolResearchContext? Context, int ClaimsRejected);

public sealed class ProtocolResearchContextMerger
{
    public ProtocolResearchMergeResult Merge(ProtocolResearchContext? existing, ProtocolResearchContext? incoming)
    {
        if (existing is null)
        {
            return new ProtocolResearchMergeResult(incoming, 0);
        }

        if (incoming is null)
        {
            return new ProtocolResearchMergeResult(existing, 0);
        }

        var mergedSourcesById = existing.Sources.ToDictionary(source => source.Id, StringComparer.Ordinal);
        foreach (var source in incoming.Sources.OrderBy(source => source.Id, StringComparer.Ordinal))
        {
            mergedSourcesById.TryAdd(source.Id, source);
        }

        var mergedClaims = new List<DocumentedClaim>(existing.Claims);
        var indexByClaimId = existing.Claims
            .Select((claim, index) => (claim.Id, index))
            .ToDictionary(item => item.Id, item => item.index, StringComparer.Ordinal);

        var claimsRejected = 0;

        foreach (var incomingClaim in incoming.Claims.OrderBy(claim => claim.Id, StringComparer.Ordinal))
        {
            if (!indexByClaimId.TryGetValue(incomingClaim.Id, out var existingIndex))
            {
                mergedClaims.Add(incomingClaim);
                continue;
            }

            var existingClaim = mergedClaims[existingIndex];
            if (existingClaim.VerificationStatus == ResearchClaimVerificationStatus.Verified)
            {
                claimsRejected++;
                continue;
            }

            if (!AreCompatible(existingClaim, incomingClaim))
            {
                claimsRejected++;
                continue;
            }

            var mergedSourceIds = existingClaim.SourceIds
                .Concat(incomingClaim.SourceIds)
                .Distinct(StringComparer.Ordinal)
                .OrderBy(id => id, StringComparer.Ordinal)
                .ToArray();

            var mergedObservedFacts = existingClaim.ObservedFactReferences
                .Concat(incomingClaim.ObservedFactReferences)
                .GroupBy(
                    fact => $"{fact.FactId}|{fact.ObservedValue}|{fact.ExpectedValue}|{fact.Note}",
                    StringComparer.Ordinal)
                .Select(group => group.First())
                .ToArray();

            mergedClaims[existingIndex] = existingClaim with
            {
                SourceIds = mergedSourceIds,
                ObservedFactReferences = mergedObservedFacts
            };
        }

        var orderedSources = mergedSourcesById.Values
            .OrderBy(source => source.Id, StringComparer.Ordinal)
            .ToArray();

        return new ProtocolResearchMergeResult(
            Context: new ProtocolResearchContext(existing.Protocol, orderedSources, mergedClaims),
            ClaimsRejected: claimsRejected);
    }

    private static bool AreCompatible(DocumentedClaim existing, DocumentedClaim incoming)
    {
        return string.Equals(existing.Category, incoming.Category, StringComparison.Ordinal)
            && string.Equals(existing.Statement, incoming.Statement, StringComparison.Ordinal)
            && existing.VerificationStatus == incoming.VerificationStatus
            && existing.VerificationMethod == incoming.VerificationMethod
            && existing.Consistency == incoming.Consistency;
    }
}
