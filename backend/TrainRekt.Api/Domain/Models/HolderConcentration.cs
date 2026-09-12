namespace TrainRekt.Api.Domain.Models;

public sealed record HolderConcentration(
    decimal? TopHolderPercentage,
    decimal? Top5HoldersPercentage,
    decimal? Top10HoldersPercentage,
    string SemanticsNote,
    UnclassifiedTokenAccountConcentration? UnclassifiedTokenAccountConcentration);
