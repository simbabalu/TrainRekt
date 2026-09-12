namespace TrainRekt.Api.Domain.Models;

public sealed record TokenAccountClassificationEvidence(string Type, string Value);

public sealed record TokenAccountClassification(
    string Classification,
    string? Protocol,
    string Confidence,
    IReadOnlyList<TokenAccountClassificationEvidence> Evidence);

public sealed record AnalyzedTokenAccount(
    string Address,
    string? Authority,
    string? Mint,
    string? TokenProgram,
    string RawAmount,
    decimal? Percentage,
    TokenAccountClassification Classification);

public sealed record RawTokenAccountConcentration(
    decimal? Top1Percentage,
    decimal? Top5Percentage,
    decimal? Top10Percentage,
    string SemanticsNote);

public sealed record UnclassifiedTokenAccountConcentration(
    decimal? ClassifiedProtocolPercentage,
    decimal? UnknownPercentageWithinReportedLargestAccounts,
    decimal? LargestUnknownTokenAccountPercentage,
    decimal? Top5UnknownTokenAccountsPercentage,
    string SemanticsNote);

public sealed record PumpFunContext(
    string Protocol,
    bool BondingCurveDetected,
    string? BondingCurveAddress,
    string? BondingCurveTokenAccount,
    bool? Complete);
