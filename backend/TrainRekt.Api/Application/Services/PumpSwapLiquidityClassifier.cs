using System.Buffers.Binary;
using Solnet.Wallet;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Infrastructure.Helius;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Application.Services;

public sealed class PumpSwapLiquidityClassifier : ITokenAccountClassifier
{
    private readonly ISolanaAccountReader _solanaAccountReader;

    public PumpSwapLiquidityClassifier(ISolanaAccountReader solanaAccountReader)
    {
        _solanaAccountReader = solanaAccountReader;
    }

    public async ValueTask<TokenAccountClassification?> TryClassifyAsync(
        TokenAccountClassificationContext context,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!IsSupportedTokenProgram(context.TokenAccountProgramId)
            || string.IsNullOrWhiteSpace(context.TokenAccountAddress)
            || string.IsNullOrWhiteSpace(context.TokenAccountMint)
            || string.IsNullOrWhiteSpace(context.TokenAccountAuthority)
            || string.IsNullOrWhiteSpace(context.Request.Mint)
            || !IsSupportedTokenProgram(context.Request.MintProgramId))
        {
            return null;
        }

        var poolAddress = context.TokenAccountAuthority;
        var pool = await TryLoadPoolByAddressAsync(poolAddress, cancellationToken);
        if (pool is null
            || !TryVerifyPoolPda(poolAddress, pool)
            || !string.Equals(context.TokenAccountMint, context.Request.Mint, StringComparison.Ordinal))
        {
            return null;
        }

        string expectedVault;
        string pairedMint;

        if (string.Equals(context.Request.Mint, pool.BaseMint, StringComparison.Ordinal))
        {
            expectedVault = pool.PoolBaseTokenAccount;
            pairedMint = pool.QuoteMint;
        }
        else if (string.Equals(context.Request.Mint, pool.QuoteMint, StringComparison.Ordinal))
        {
            expectedVault = pool.PoolQuoteTokenAccount;
            pairedMint = pool.BaseMint;
        }
        else
        {
            return null;
        }

        if (!string.Equals(context.TokenAccountAddress, expectedVault, StringComparison.Ordinal))
        {
            return null;
        }

        return new TokenAccountClassification(
            Classification: TokenAccountClassificationConstants.LiquidityPool,
            Protocol: ProtocolConstants.PumpSwapProtocolName,
            Confidence: TokenAccountClassificationConstants.Verified,
            Evidence: new[]
            {
                new TokenAccountClassificationEvidence("verified_program_id", ProtocolConstants.PumpSwapProgramId),
                new TokenAccountClassificationEvidence("verified_pool_account", poolAddress),
                new TokenAccountClassificationEvidence("verified_pool_vault", expectedVault),
                new TokenAccountClassificationEvidence("pool_base_mint", pool.BaseMint),
                new TokenAccountClassificationEvidence("pool_quote_mint", pool.QuoteMint),
                new TokenAccountClassificationEvidence("paired_mint", pairedMint)
            });
    }

    private async Task<ParsedPumpSwapPoolAccount?> TryLoadPoolByAddressAsync(string poolAddress, CancellationToken cancellationToken)
    {
        try
        {
            var accountInfo = await _solanaAccountReader.GetAccountInfoAsync(poolAddress, cancellationToken);

            if (accountInfo is null
                || !string.Equals(accountInfo.OwnerProgramId, ProtocolConstants.PumpSwapProgramId, StringComparison.Ordinal)
                || !PumpSwapPoolParser.TryParse(accountInfo.Data, out var parsed)
                || parsed is null)
            {
                return null;
            }

            return parsed;
        }
        catch (HeliusRpcException)
        {
            return null;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    private static bool TryVerifyPoolPda(string poolAddress, ParsedPumpSwapPoolAccount pool)
    {
        if (!Base58Codec.TryDecode(pool.Creator, out var creatorBytes)
            || !Base58Codec.TryDecode(pool.BaseMint, out var baseMintBytes)
            || !Base58Codec.TryDecode(pool.QuoteMint, out var quoteMintBytes))
        {
            return false;
        }

        var indexSeed = new byte[2];
        BinaryPrimitives.WriteUInt16LittleEndian(indexSeed, pool.Index);

        if (!PublicKey.TryFindProgramAddress(
                new[]
                {
                    System.Text.Encoding.UTF8.GetBytes(ProtocolConstants.PumpSwapPoolSeed),
                    indexSeed,
                    creatorBytes,
                    baseMintBytes,
                    quoteMintBytes
                },
                new PublicKey(ProtocolConstants.PumpSwapProgramId),
                out var derivedPool,
                out _))
        {
            return false;
        }

        return string.Equals(poolAddress, derivedPool.Key, StringComparison.Ordinal);
    }

    private static bool IsSupportedTokenProgram(string? programId)
    {
        return string.Equals(programId, SolanaTokenConstants.SplTokenProgramId, StringComparison.Ordinal)
            || string.Equals(programId, SolanaTokenConstants.Token2022ProgramId, StringComparison.Ordinal);
    }
}
