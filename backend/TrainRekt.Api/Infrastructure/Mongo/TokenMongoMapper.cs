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
}
