using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class PumpFunBondingCurveClassifier : ITokenAccountClassifier
{
    public ValueTask<TokenAccountClassification?> TryClassifyAsync(
        TokenAccountClassificationContext context,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var pumpFun = context.Request.PumpFun;
        if (pumpFun is null || !pumpFun.BondingCurveAccountVerified)
        {
            return ValueTask.FromResult<TokenAccountClassification?>(null);
        }

        if (!string.Equals(context.TokenAccountAddress, pumpFun.BondingCurveTokenAccount, StringComparison.Ordinal)
            || !string.Equals(context.TokenAccountAuthority, pumpFun.BondingCurveAddress, StringComparison.Ordinal)
            || !string.Equals(context.TokenAccountMint, context.Request.Mint, StringComparison.Ordinal))
        {
            return ValueTask.FromResult<TokenAccountClassification?>(null);
        }

        var classification = new TokenAccountClassification(
            Classification: TokenAccountClassificationConstants.BondingCurve,
            Protocol: ProtocolConstants.PumpFunProtocolName,
            Confidence: TokenAccountClassificationConstants.Verified,
            Evidence: new[]
            {
                new TokenAccountClassificationEvidence("verified_program_id", pumpFun.ProgramId),
                new TokenAccountClassificationEvidence("derived_bonding_curve_pda", pumpFun.BondingCurveAddress),
                new TokenAccountClassificationEvidence("derived_bonding_curve_token_account", pumpFun.BondingCurveTokenAccount),
                new TokenAccountClassificationEvidence("token_account_authority", context.TokenAccountAuthority ?? string.Empty)
            });

        return ValueTask.FromResult<TokenAccountClassification?>(classification);
    }
}
