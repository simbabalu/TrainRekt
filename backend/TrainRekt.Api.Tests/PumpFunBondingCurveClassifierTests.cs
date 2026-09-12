using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Tests;

public sealed class PumpFunBondingCurveClassifierTests
{
    [Fact]
    public async Task TryClassifyAsync_WhenDerivedPumpFunAccountMatches_ReturnsVerifiedBondingCurve()
    {
        var classifier = new PumpFunBondingCurveClassifier();
        var context = new TokenAccountClassificationContext(
            Request: new TokenAccountClassificationRequestContext(
                Mint: "So11111111111111111111111111111111111111112",
                MintProgramId: SolanaTokenConstants.SplTokenProgramId,
                PumpFun: new PumpFunDerivation(
                    ProgramId: ProtocolConstants.PumpFunProgramId,
                    BondingCurveAddress: "curve",
                    BondingCurveTokenAccount: "curve-token-account",
                    BondingCurveAccountVerified: true,
                    Complete: false)),
            TokenAccountAddress: "curve-token-account",
            TokenAccountMint: "So11111111111111111111111111111111111111112",
            TokenAccountAuthority: "curve",
            TokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            TokenAccountAmountRaw: 100,
            PercentageOfSupply: 10m);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(TokenAccountClassificationConstants.BondingCurve, result.Classification);
        Assert.Equal(ProtocolConstants.PumpFunProtocolName, result.Protocol);
        Assert.Equal(TokenAccountClassificationConstants.Verified, result.Confidence);
        Assert.Contains(result.Evidence, entry => entry.Type == "verified_program_id" && entry.Value == ProtocolConstants.PumpFunProgramId);
    }

    [Fact]
    public async Task TryClassifyAsync_WhenPumpFunNotVerified_ReturnsNull()
    {
        var classifier = new PumpFunBondingCurveClassifier();
        var context = new TokenAccountClassificationContext(
            Request: new TokenAccountClassificationRequestContext(
                Mint: "So11111111111111111111111111111111111111112",
                MintProgramId: SolanaTokenConstants.SplTokenProgramId,
                PumpFun: new PumpFunDerivation(
                    ProgramId: ProtocolConstants.PumpFunProgramId,
                    BondingCurveAddress: "curve",
                    BondingCurveTokenAccount: "curve-token-account",
                    BondingCurveAccountVerified: false,
                    Complete: null)),
            TokenAccountAddress: "curve-token-account",
            TokenAccountMint: "So11111111111111111111111111111111111111112",
            TokenAccountAuthority: "curve",
            TokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            TokenAccountAmountRaw: 100,
            PercentageOfSupply: 10m);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
    }
}
