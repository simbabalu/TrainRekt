using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenIdentityClassifierTests
{
    [Fact]
    public void Classify_MissingIdentity_ReturnsInsufficientEvidence()
    {
        var classifier = new TokenIdentityClassifier();
        var provenance = CreateBaseProvenance(name: null, symbol: null, collisions: Array.Empty<TokenIdentityCollision>());

        var result = classifier.Classify(provenance);

        Assert.Equal(TokenIdentityClassificationType.InsufficientEvidence, result.Classification);
        Assert.Equal(TokenIdentityClassificationConfidence.None, result.Confidence);
    }

    [Fact]
    public void Classify_NoCollision_ReturnsNoCollisionEvidence()
    {
        var classifier = new TokenIdentityClassifier();
        var provenance = CreateBaseProvenance(collisions: Array.Empty<TokenIdentityCollision>());

        var result = classifier.Classify(provenance);

        Assert.Equal(TokenIdentityClassificationType.NoCollisionEvidence, result.Classification);
    }

    [Fact]
    public void Classify_SymbolOnlyCollision_ReturnsCollisionDetected()
    {
        var classifier = new TokenIdentityClassifier();
        var provenance = CreateBaseProvenance(collisions: new[]
        {
            CreateCollision("MintB", name: false, symbol: true)
        });

        var result = classifier.Classify(provenance);

        Assert.Equal(TokenIdentityClassificationType.CollisionDetected, result.Classification);
        Assert.DoesNotContain(TokenIdentityClassificationEvidence.SameNormalizedName, result.Evidence);
    }

    [Fact]
    public void Classify_TrustedCompetitorWithoutComparableChronology_ReturnsCollisionDetected()
    {
        var classifier = new TokenIdentityClassifier();
        var provenance = CreateBaseProvenance(
            collisions: new[]
            {
                CreateCollision("MintB", name: true, symbol: true)
            },
            trusted: new TrustedIdentityProvenance(
                Sources: new[]
                {
                    new IdentitySourceEvidence(
                        Url: "https://trusted.example",
                        Publisher: "trusted",
                        SourceTrust: IdentitySourceTrust.Trusted,
                        MintLinkStatus: IdentityMintLinkStatus.ReferencesCompetingMint,
                        ReferencedRelevantMints: new[] { "MintB" },
                        EvidenceSummary: "trusted competitor")
                },
                Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>(),
                AnalyzedAtUtc: DateTimeOffset.UtcNow),
            scannedChronology: new OnChainChronologyEvidence(
                EarliestObservedSignature: "sig-a",
                EarliestObservedSlot: 50,
                EarliestObservedBlockTimeUtc: DateTimeOffset.UtcNow,
                HistoryCoverage: OnChainChronologyCoverage.PartialPageLimit,
                PaginationExhausted: false,
                PagesScanned: 1,
                SignaturesScanned: 1,
                Source: "HELIUS_SOLANA_RPC",
                Confidence: OnChainChronologyConfidence.Medium,
                Precision: OnChainChronologyPrecision.SlotOnly,
                AccountCreationProven: false,
                Unknowns: new[] { OnChainChronologyUnknown.ChainHistoryPartial },
                AnalyzedAtUtc: DateTimeOffset.UtcNow));

        var result = classifier.Classify(provenance);

        Assert.Equal(TokenIdentityClassificationType.CollisionDetected, result.Classification);
        Assert.Contains(TokenIdentityClassificationLimitation.ChronologyComparisonUnavailable, result.Limitations);
    }

    [Fact]
    public void Classify_TrustedCompetitorAndScannedLaterOnChain_ReturnsPossibleCopycat()
    {
        var classifier = new TokenIdentityClassifier();
        var now = DateTimeOffset.UtcNow;
        var provenance = CreateBaseProvenance(
            collisions: new[]
            {
                CreateCollision("MintB", name: true, symbol: true)
            },
            trusted: new TrustedIdentityProvenance(
                Sources: new[]
                {
                    new IdentitySourceEvidence(
                        Url: "https://trusted.example",
                        Publisher: "trusted",
                        SourceTrust: IdentitySourceTrust.Trusted,
                        MintLinkStatus: IdentityMintLinkStatus.ReferencesCompetingMint,
                        ReferencedRelevantMints: new[] { "MintB" },
                        EvidenceSummary: "trusted competitor")
                },
                Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>(),
                AnalyzedAtUtc: now),
            scannedChronology: CompleteChronology(slot: 100, now),
            competingChronologies: new[]
            {
                new CompetingMintChronologyEvidence("MintB", CompleteChronology(slot: 10, now))
            });

        var result = classifier.Classify(provenance);

        Assert.Equal(TokenIdentityClassificationType.PossibleCopycat, result.Classification);
        Assert.Equal(TokenIdentityClassificationConfidence.High, result.Confidence);
        Assert.Contains(TokenIdentityClassificationEvidence.ScannedMintLaterOnChain, result.Evidence);
        Assert.Contains(TokenIdentityClassificationLimitation.CopyingIntentNotProven, result.Limitations);
        Assert.Contains(TokenIdentityClassificationLimitation.GlobalFirstTokenNotProven, result.Limitations);
        Assert.Contains(TokenIdentityClassificationLimitation.SocialContextNotAnalyzed, result.Limitations);
    }

    [Fact]
    public void Classify_TrustedConflict_ReturnsIdentityConflict()
    {
        var classifier = new TokenIdentityClassifier();
        var provenance = CreateBaseProvenance(
            collisions: new[] { CreateCollision("MintB", name: true, symbol: true) },
            trusted: new TrustedIdentityProvenance(
                Sources: Array.Empty<IdentitySourceEvidence>(),
                Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Conflicts: new[] { new TokenIdentityProvenanceEvidence("TRUSTED_SOURCE_REFERENCES_MULTIPLE_RELEVANT_MINTS", "conflict") },
                Unknowns: new[] { TrustedIdentityProvenanceUnknown.IdentitySourceConflict },
                AnalyzedAtUtc: DateTimeOffset.UtcNow));

        var result = classifier.Classify(provenance);

        Assert.Equal(TokenIdentityClassificationType.IdentityConflict, result.Classification);
    }

    [Fact]
    public void Classify_TrustedAlsoReferencesScanned_YieldsIdentityConflict()
    {
        var classifier = new TokenIdentityClassifier();
        var now = DateTimeOffset.UtcNow;
        var provenance = CreateBaseProvenance(
            collisions: new[] { CreateCollision("MintB", name: true, symbol: true) },
            trusted: new TrustedIdentityProvenance(
                Sources: new[]
                {
                    new IdentitySourceEvidence("https://trusted.example/a", "trusted", IdentitySourceTrust.Trusted, IdentityMintLinkStatus.ReferencesCompetingMint, new[] { "MintB" }, "a"),
                    new IdentitySourceEvidence("https://trusted.example/b", "trusted", IdentitySourceTrust.Trusted, IdentityMintLinkStatus.ReferencesScannedMint, new[] { "MintA" }, "b")
                },
                Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
                Unknowns: Array.Empty<TrustedIdentityProvenanceUnknown>(),
                AnalyzedAtUtc: now),
            scannedChronology: CompleteChronology(slot: 100, now),
            competingChronologies: new[]
            {
                new CompetingMintChronologyEvidence("MintB", CompleteChronology(slot: 10, now))
            });

        var result = classifier.Classify(provenance);

        Assert.Equal(TokenIdentityClassificationType.IdentityConflict, result.Classification);
    }

    private static TokenIdentityProvenance CreateBaseProvenance(
        string? name = "name",
        string? symbol = "sym",
        IReadOnlyList<TokenIdentityCollision>? collisions = null,
        TrustedIdentityProvenance? trusted = null,
        OnChainChronologyEvidence? scannedChronology = null,
        IReadOnlyList<CompetingMintChronologyEvidence>? competingChronologies = null)
    {
        collisions ??= Array.Empty<TokenIdentityCollision>();
        trusted ??= new TrustedIdentityProvenance(
            Sources: Array.Empty<IdentitySourceEvidence>(),
            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Conflicts: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Unknowns: new[] { TrustedIdentityProvenanceUnknown.NoTrustedIdentitySourceAvailable },
            AnalyzedAtUtc: DateTimeOffset.UtcNow);

        return new TokenIdentityProvenance(
            Result: TokenIdentityProvenanceResultType.CollisionObserved,
            Confidence: TokenIdentityProvenanceConfidence.Medium,
            ScannedIdentity: new TokenIdentityProvenanceScannedIdentity("MintA", name, name, symbol, symbol, DateTimeOffset.UtcNow),
            EarliestObservedMatch: null,
            Collisions: collisions,
            TotalCollisionCount: collisions.Count,
            ReturnedCollisionCount: collisions.Count,
            IsTruncated: false,
            Evidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            ConflictingEvidence: Array.Empty<TokenIdentityProvenanceEvidence>(),
            Unknowns: Array.Empty<TokenIdentityProvenanceUnknown>(),
            AnalyzedAtUtc: DateTimeOffset.UtcNow,
            OnChainChronology: scannedChronology ?? CompleteChronology(50, DateTimeOffset.UtcNow),
            TrustedIdentityProvenance: trusted,
            CompetingMintChronologies: competingChronologies);
    }

    private static TokenIdentityCollision CreateCollision(string mint, bool name, bool symbol)
    {
        var dimensions = new List<TokenIdentityMatchDimension>();
        if (name)
        {
            dimensions.Add(TokenIdentityMatchDimension.Name);
        }

        if (symbol)
        {
            dimensions.Add(TokenIdentityMatchDimension.Symbol);
        }

        return new TokenIdentityCollision(
            CandidateMint: mint,
            RawName: "name",
            RawSymbol: "sym",
            MatchDimensions: dimensions,
            MatchLevel: TokenIdentityMatchLevel.Exact,
            FirstObservedAtUtc: DateTimeOffset.UtcNow.AddMinutes(-5),
            LastObservedAtUtc: DateTimeOffset.UtcNow);
    }

    private static OnChainChronologyEvidence CompleteChronology(long slot, DateTimeOffset now)
    {
        return new OnChainChronologyEvidence(
            EarliestObservedSignature: "sig",
            EarliestObservedSlot: slot,
            EarliestObservedBlockTimeUtc: now,
            HistoryCoverage: OnChainChronologyCoverage.CompleteWithinProviderResult,
            PaginationExhausted: true,
            PagesScanned: 1,
            SignaturesScanned: 1,
            Source: "HELIUS_SOLANA_RPC",
            Confidence: OnChainChronologyConfidence.High,
            Precision: OnChainChronologyPrecision.SlotOnly,
            AccountCreationProven: false,
            Unknowns: new[] { OnChainChronologyUnknown.CanonicalCreationTimeNotProven },
            AnalyzedAtUtc: now);
    }
}
