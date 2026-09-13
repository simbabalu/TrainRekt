using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Mongo.Documents;

namespace TrainRekt.Api.Infrastructure.Mongo;

internal static class TokenMongoMapper
{
    public static TokenDocument ToDocument(CachedToken model)
    {
        return new TokenDocument
        {
            Mint = model.Mint,
            Name = model.Name,
            Symbol = model.Symbol,
            ProgramId = model.ProgramId,
            FirstSeenAtUtc = DateTime.SpecifyKind(model.FirstSeenAtUtc.UtcDateTime, DateTimeKind.Utc),
            LastSeenAtUtc = DateTime.SpecifyKind(model.LastSeenAtUtc.UtcDateTime, DateTimeKind.Utc)
        };
    }

    public static CachedToken ToModel(TokenDocument document)
    {
        return new CachedToken(
            Mint: document.Mint,
            Name: document.Name,
            Symbol: document.Symbol,
            ProgramId: document.ProgramId,
            FirstSeenAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.FirstSeenAtUtc, DateTimeKind.Utc)),
            LastSeenAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.LastSeenAtUtc, DateTimeKind.Utc)));
    }

    public static TokenInspectionSnapshotDocument ToDocument(CachedTokenInspectionSnapshot model)
    {
        return new TokenInspectionSnapshotDocument
        {
            Mint = model.Mint,
            InspectedAtUtc = DateTime.SpecifyKind(model.InspectedAtUtc.UtcDateTime, DateTimeKind.Utc),
            CachedAtUtc = DateTime.SpecifyKind(model.CachedAtUtc.UtcDateTime, DateTimeKind.Utc),
            AnalysisVersion = model.AnalysisVersion,
            ExpiresAtUtc = DateTime.SpecifyKind(model.ExpiresAtUtc.UtcDateTime, DateTimeKind.Utc),
            Result = model.Result
        };
    }

    public static CachedTokenInspectionSnapshot ToModel(TokenInspectionSnapshotDocument document)
    {
        return new CachedTokenInspectionSnapshot(
            Id: document.Id,
            Mint: document.Mint,
            InspectedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.InspectedAtUtc, DateTimeKind.Utc)),
            CachedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.CachedAtUtc, DateTimeKind.Utc)),
            AnalysisVersion: document.AnalysisVersion,
            ExpiresAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.ExpiresAtUtc, DateTimeKind.Utc)),
            Result: document.Result);
    }

    public static TokenResearchSnapshotDocument ToDocument(CachedTokenResearchSnapshot model)
    {
        return new TokenResearchSnapshotDocument
        {
            Mint = model.Mint,
            Protocol = model.Protocol,
            ResearchVersion = model.ResearchVersion,
            ResearchedAtUtc = DateTime.SpecifyKind(model.ResearchedAtUtc.UtcDateTime, DateTimeKind.Utc),
            CachedAtUtc = DateTime.SpecifyKind(model.CachedAtUtc.UtcDateTime, DateTimeKind.Utc),
            ExpiresAtUtc = DateTime.SpecifyKind(model.ExpiresAtUtc.UtcDateTime, DateTimeKind.Utc),
            Context = model.Context
        };
    }

    public static CachedTokenResearchSnapshot ToModel(TokenResearchSnapshotDocument document)
    {
        return new CachedTokenResearchSnapshot(
            Id: document.Id,
            Mint: document.Mint,
            Protocol: document.Protocol,
            ResearchVersion: document.ResearchVersion,
            ResearchedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.ResearchedAtUtc, DateTimeKind.Utc)),
            CachedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.CachedAtUtc, DateTimeKind.Utc)),
            ExpiresAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.ExpiresAtUtc, DateTimeKind.Utc)),
            Context: document.Context);
    }

    public static TokenInspectionCoachSnapshotDocument ToDocument(CachedTokenInspectionCoachSnapshot model)
    {
        return new TokenInspectionCoachSnapshotDocument
        {
            Mint = model.Mint,
            Language = model.Language,
            CoachVersion = model.CoachVersion,
            InputFingerprint = model.InputFingerprint,
            CachedAtUtc = DateTime.SpecifyKind(model.CachedAtUtc.UtcDateTime, DateTimeKind.Utc),
            ExpiresAtUtc = DateTime.SpecifyKind(model.ExpiresAtUtc.UtcDateTime, DateTimeKind.Utc),
            Coach = model.Coach
        };
    }

    public static CachedTokenInspectionCoachSnapshot ToModel(TokenInspectionCoachSnapshotDocument document)
    {
        return new CachedTokenInspectionCoachSnapshot(
            Id: document.Id,
            Mint: document.Mint,
            Language: document.Language,
            CoachVersion: document.CoachVersion,
            InputFingerprint: document.InputFingerprint,
            CachedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.CachedAtUtc, DateTimeKind.Utc)),
            ExpiresAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.ExpiresAtUtc, DateTimeKind.Utc)),
            Coach: document.Coach);
    }

    public static TokenIdentityObservationDocument ToDocument(TokenIdentityObservation model)
    {
        return new TokenIdentityObservationDocument
        {
            Mint = model.Mint,
            FirstRawName = model.RawName,
            FirstNormalizedName = model.NormalizedName,
            FirstRawSymbol = model.RawSymbol,
            FirstNormalizedSymbol = model.NormalizedSymbol,
            LastRawName = model.RawName,
            LastNormalizedName = model.NormalizedName,
            LastRawSymbol = model.RawSymbol,
            LastNormalizedSymbol = model.NormalizedSymbol,
            TokenProgram = model.TokenProgram,
            FirstObservedAtUtc = DateTime.SpecifyKind(model.FirstObservedAtUtc.UtcDateTime, DateTimeKind.Utc),
            LastObservedAtUtc = DateTime.SpecifyKind(model.LastObservedAtUtc.UtcDateTime, DateTimeKind.Utc),
            ObservationVersion = model.ObservationVersion
        };
    }

    public static TokenIdentityObservation ToModel(TokenIdentityObservationDocument document)
    {
        return new TokenIdentityObservation(
            Mint: document.Mint,
            RawName: document.LastRawName,
            NormalizedName: document.LastNormalizedName,
            RawSymbol: document.LastRawSymbol,
            NormalizedSymbol: document.LastNormalizedSymbol,
            TokenProgram: document.TokenProgram,
            FirstObservedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.FirstObservedAtUtc, DateTimeKind.Utc)),
            LastObservedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.LastObservedAtUtc, DateTimeKind.Utc)),
            ObservationVersion: document.ObservationVersion);
    }

    public static TokenIdentityChronologySnapshotDocument ToDocument(CachedTokenIdentityChronologySnapshot model)
    {
        return new TokenIdentityChronologySnapshotDocument
        {
            Mint = model.Mint,
            ChronologyVersion = model.ChronologyVersion,
            AnalyzedAtUtc = DateTime.SpecifyKind(model.AnalyzedAtUtc.UtcDateTime, DateTimeKind.Utc),
            CachedAtUtc = DateTime.SpecifyKind(model.CachedAtUtc.UtcDateTime, DateTimeKind.Utc),
            ExpiresAtUtc = DateTime.SpecifyKind(model.ExpiresAtUtc.UtcDateTime, DateTimeKind.Utc),
            Evidence = model.Evidence
        };
    }

    public static CachedTokenIdentityChronologySnapshot ToModel(TokenIdentityChronologySnapshotDocument document)
    {
        return new CachedTokenIdentityChronologySnapshot(
            Id: document.Id,
            Mint: document.Mint,
            ChronologyVersion: document.ChronologyVersion,
            AnalyzedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.AnalyzedAtUtc, DateTimeKind.Utc)),
            CachedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.CachedAtUtc, DateTimeKind.Utc)),
            ExpiresAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.ExpiresAtUtc, DateTimeKind.Utc)),
            Evidence: document.Evidence);
    }

    public static TokenIdentitySourceVerificationSnapshotDocument ToDocument(CachedTokenIdentitySourceVerificationSnapshot model)
    {
        return new TokenIdentitySourceVerificationSnapshotDocument
        {
            CanonicalUrl = model.CanonicalUrl,
            RelevantMintSetFingerprint = model.RelevantMintSetFingerprint,
            IdentityProvenanceVersion = model.IdentityProvenanceVersion,
            AnalyzedAtUtc = DateTime.SpecifyKind(model.AnalyzedAtUtc.UtcDateTime, DateTimeKind.Utc),
            CachedAtUtc = DateTime.SpecifyKind(model.CachedAtUtc.UtcDateTime, DateTimeKind.Utc),
            ExpiresAtUtc = DateTime.SpecifyKind(model.ExpiresAtUtc.UtcDateTime, DateTimeKind.Utc),
            SourceEvidence = model.SourceEvidence,
            Evidence = model.Evidence.ToList(),
            Conflicts = model.Conflicts.ToList(),
            Unknowns = model.Unknowns.ToList()
        };
    }

    public static CachedTokenIdentitySourceVerificationSnapshot ToModel(TokenIdentitySourceVerificationSnapshotDocument document)
    {
        return new CachedTokenIdentitySourceVerificationSnapshot(
            Id: document.Id,
            CanonicalUrl: document.CanonicalUrl,
            RelevantMintSetFingerprint: document.RelevantMintSetFingerprint,
            IdentityProvenanceVersion: document.IdentityProvenanceVersion,
            AnalyzedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.AnalyzedAtUtc, DateTimeKind.Utc)),
            CachedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.CachedAtUtc, DateTimeKind.Utc)),
            ExpiresAtUtc: new DateTimeOffset(DateTime.SpecifyKind(document.ExpiresAtUtc, DateTimeKind.Utc)),
            SourceEvidence: document.SourceEvidence,
            Evidence: document.Evidence,
            Conflicts: document.Conflicts,
            Unknowns: document.Unknowns);
    }
}
