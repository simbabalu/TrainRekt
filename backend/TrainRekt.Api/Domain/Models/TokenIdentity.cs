namespace TrainRekt.Api.Domain.Models;

public sealed record TokenIdentity(
    string Mint,
    string? Name,
    string? Symbol,
    int Decimals,
    string SupplyRaw,
    string ProgramId,
    string? MetadataUri);
