using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public sealed record PumpFunDerivation(
    string ProgramId,
    string BondingCurveAddress,
    string BondingCurveTokenAccount,
    bool BondingCurveAccountVerified,
    bool? Complete);

public sealed record TokenAccountClassificationRequestContext(
    string Mint,
    string MintProgramId,
    PumpFunDerivation? PumpFun);

public sealed record TokenAccountClassificationContext(
    TokenAccountClassificationRequestContext Request,
    string TokenAccountAddress,
    string? TokenAccountMint,
    string? TokenAccountAuthority,
    string? TokenAccountProgramId,
    ulong TokenAccountAmountRaw,
    decimal? PercentageOfSupply);

public interface ITokenAccountClassifier
{
    ValueTask<TokenAccountClassification?> TryClassifyAsync(
        TokenAccountClassificationContext context,
        CancellationToken cancellationToken);
}

public interface ITokenAccountClassificationService
{
    Task<TokenAccountClassification> ClassifyAsync(
        TokenAccountClassificationContext context,
        CancellationToken cancellationToken);
}
