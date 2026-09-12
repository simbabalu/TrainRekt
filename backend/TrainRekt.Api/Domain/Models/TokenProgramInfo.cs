namespace TrainRekt.Api.Domain.Models;

public sealed record TokenProgramInfo(
    string ProgramType,
    string ProgramId,
    IReadOnlyList<string> Token2022Extensions);
