using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenIdentityClassifier : ITokenIdentityClassifier
{
    public TokenIdentityClassification Classify(TokenIdentityProvenance provenance)
    {
        var baseLimitations = new[]
        {
            TokenIdentityClassificationLimitation.CopyingIntentNotProven,
            TokenIdentityClassificationLimitation.GlobalFirstTokenNotProven,
            TokenIdentityClassificationLimitation.SocialContextNotAnalyzed
        };

        if (provenance.ScannedIdentity.NormalizedName is null && provenance.ScannedIdentity.NormalizedSymbol is null)
        {
            return new TokenIdentityClassification(
                Classification: TokenIdentityClassificationType.InsufficientEvidence,
                Confidence: TokenIdentityClassificationConfidence.None,
                RelevantCompetingMint: null,
                Evidence: Array.Empty<TokenIdentityClassificationEvidence>(),
                Limitations: baseLimitations);
        }

        if (provenance.Collisions.Count == 0)
        {
            return new TokenIdentityClassification(
                Classification: TokenIdentityClassificationType.NoCollisionEvidence,
                Confidence: TokenIdentityClassificationConfidence.Medium,
                RelevantCompetingMint: null,
                Evidence: Array.Empty<TokenIdentityClassificationEvidence>(),
                Limitations: baseLimitations);
        }

        if (HasTrustedIdentityConflict(provenance))
        {
            return new TokenIdentityClassification(
                Classification: TokenIdentityClassificationType.IdentityConflict,
                Confidence: TokenIdentityClassificationConfidence.High,
                RelevantCompetingMint: null,
                Evidence: new[] { TokenIdentityClassificationEvidence.TrustedIdentityConflict },
                Limitations: baseLimitations);
        }

        var strongestCollision = SelectStrongestCollision(provenance.Collisions);
        if (strongestCollision is null)
        {
            return new TokenIdentityClassification(
                Classification: TokenIdentityClassificationType.InsufficientEvidence,
                Confidence: TokenIdentityClassificationConfidence.Low,
                RelevantCompetingMint: null,
                Evidence: Array.Empty<TokenIdentityClassificationEvidence>(),
                Limitations: baseLimitations);
        }

        var evidence = new List<TokenIdentityClassificationEvidence>
        {
            TokenIdentityClassificationEvidence.CompetingMintObserved
        };

        if (strongestCollision.MatchDimensions.Contains(TokenIdentityMatchDimension.Name))
        {
            evidence.Add(TokenIdentityClassificationEvidence.SameNormalizedName);
        }

        if (strongestCollision.MatchDimensions.Contains(TokenIdentityMatchDimension.Symbol))
        {
            evidence.Add(TokenIdentityClassificationEvidence.SameNormalizedSymbol);
        }

        var trusted = provenance.TrustedIdentityProvenance;
        var trustedReferencesCompetitor = trusted?.Sources.Any(source =>
            source.SourceTrust == IdentitySourceTrust.Trusted
            && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesCompetingMint
            && source.ReferencedRelevantMints.Contains(strongestCollision.CandidateMint, StringComparer.Ordinal)) == true;

        var trustedReferencesScanned = trusted?.Sources.Any(source =>
            source.SourceTrust == IdentitySourceTrust.Trusted
            && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesScannedMint) == true;

        if (!trustedReferencesCompetitor || trustedReferencesScanned)
        {
            return new TokenIdentityClassification(
                Classification: TokenIdentityClassificationType.CollisionDetected,
                Confidence: TokenIdentityClassificationConfidence.Medium,
                RelevantCompetingMint: strongestCollision.CandidateMint,
                Evidence: evidence,
                Limitations: baseLimitations.Append(TokenIdentityClassificationLimitation.OfficialIdentityNotFullyVerified).ToArray());
        }

        evidence.Add(TokenIdentityClassificationEvidence.TrustedSourceReferencesCompetingMint);
        evidence.Add(TokenIdentityClassificationEvidence.TrustedSourceDoesNotVerifyScannedMint);

        var scannedChronology = provenance.OnChainChronology;
        var competitorChronology = provenance.CompetingMintChronologies?
            .FirstOrDefault(entry => string.Equals(entry.Mint, strongestCollision.CandidateMint, StringComparison.Ordinal))
            ?.Chronology;

        if (!IsChronologyComparable(scannedChronology) || !IsChronologyComparable(competitorChronology))
        {
            return new TokenIdentityClassification(
                Classification: TokenIdentityClassificationType.CollisionDetected,
                Confidence: TokenIdentityClassificationConfidence.Medium,
                RelevantCompetingMint: strongestCollision.CandidateMint,
                Evidence: evidence,
                Limitations: baseLimitations
                    .Append(TokenIdentityClassificationLimitation.ChronologyComparisonUnavailable)
                    .Append(TokenIdentityClassificationLimitation.ProviderHistoryMayBeIncomplete)
                    .ToArray());
        }

        if (scannedChronology!.EarliestObservedSlot <= competitorChronology!.EarliestObservedSlot)
        {
            return new TokenIdentityClassification(
                Classification: TokenIdentityClassificationType.CollisionDetected,
                Confidence: TokenIdentityClassificationConfidence.Medium,
                RelevantCompetingMint: strongestCollision.CandidateMint,
                Evidence: evidence,
                Limitations: baseLimitations);
        }

        evidence.Add(TokenIdentityClassificationEvidence.ScannedMintLaterOnChain);

        return new TokenIdentityClassification(
            Classification: TokenIdentityClassificationType.PossibleCopycat,
            Confidence: TokenIdentityClassificationConfidence.High,
            RelevantCompetingMint: strongestCollision.CandidateMint,
            Evidence: evidence,
            Limitations: baseLimitations);
    }

    private static bool HasTrustedIdentityConflict(TokenIdentityProvenance provenance)
    {
        var trusted = provenance.TrustedIdentityProvenance;
        if (trusted is null)
        {
            return false;
        }

        if (trusted.Unknowns.Contains(TrustedIdentityProvenanceUnknown.IdentitySourceConflict)
            || trusted.Conflicts.Count > 0)
        {
            return true;
        }

        var trustedMultiple = trusted.Sources.Any(source =>
            source.SourceTrust == IdentitySourceTrust.Trusted
            && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesMultipleRelevantMints);

        if (trustedMultiple)
        {
            return true;
        }

        var trustedScanned = trusted.Sources.Any(source =>
            source.SourceTrust == IdentitySourceTrust.Trusted
            && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesScannedMint);

        var trustedCompeting = trusted.Sources.Any(source =>
            source.SourceTrust == IdentitySourceTrust.Trusted
            && source.MintLinkStatus == IdentityMintLinkStatus.ReferencesCompetingMint);

        return trustedScanned && trustedCompeting;
    }

    private static TokenIdentityCollision? SelectStrongestCollision(IReadOnlyList<TokenIdentityCollision> collisions)
    {
        return collisions
            .OrderBy(collision => Strength(collision))
            .ThenBy(collision => collision.FirstObservedAtUtc)
            .ThenBy(collision => collision.CandidateMint, StringComparer.Ordinal)
            .FirstOrDefault();
    }

    private static int Strength(TokenIdentityCollision collision)
    {
        var hasName = collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Name);
        var hasSymbol = collision.MatchDimensions.Contains(TokenIdentityMatchDimension.Symbol);

        if (hasName && hasSymbol)
        {
            return 0;
        }

        if (hasName)
        {
            return 1;
        }

        if (hasSymbol)
        {
            return 2;
        }

        return 3;
    }

    private static bool IsChronologyComparable(OnChainChronologyEvidence? chronology)
    {
        return chronology is not null
            && chronology.EarliestObservedSlot is not null
            && chronology.HistoryCoverage == OnChainChronologyCoverage.CompleteWithinProviderResult;
    }
}
