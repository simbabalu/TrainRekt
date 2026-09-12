using Solnet.Wallet;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Infrastructure.Helius;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Application.Services;

public sealed class SkrStakingVaultClassifier : ITokenAccountClassifier
{
    private readonly ISolanaAccountReader _solanaAccountReader;

    public SkrStakingVaultClassifier(ISolanaAccountReader solanaAccountReader)
    {
        _solanaAccountReader = solanaAccountReader;
    }

    public async ValueTask<TokenAccountClassification?> TryClassifyAsync(
        TokenAccountClassificationContext context,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!IsSupportedTokenProgram(context.TokenAccountProgramId)
            || !IsSupportedTokenProgram(context.Request.MintProgramId)
            || !string.Equals(context.Request.Mint, ProtocolConstants.SolanaMobileSkrMint, StringComparison.Ordinal)
            || !string.Equals(context.TokenAccountAddress, ProtocolConstants.SolanaMobileSkrStakeVaultAddress, StringComparison.Ordinal)
            || !string.Equals(context.TokenAccountMint, ProtocolConstants.SolanaMobileSkrMint, StringComparison.Ordinal)
            || string.IsNullOrWhiteSpace(context.TokenAccountAuthority))
        {
            return null;
        }

        if (!TryDeriveProgramPdas(out var derivedStakeConfig, out var derivedStakeVault))
        {
            return null;
        }

        if (!string.Equals(derivedStakeConfig, ProtocolConstants.SolanaMobileSkrStakeConfigAddress, StringComparison.Ordinal)
            || !string.Equals(derivedStakeVault, ProtocolConstants.SolanaMobileSkrStakeVaultAddress, StringComparison.Ordinal)
            || !string.Equals(context.TokenAccountAuthority, derivedStakeConfig, StringComparison.Ordinal)
            || !string.Equals(context.TokenAccountAddress, derivedStakeVault, StringComparison.Ordinal))
        {
            return null;
        }

        var stakeConfig = await TryLoadStakeConfigAsync(derivedStakeConfig, cancellationToken);
        if (stakeConfig is null
            || !string.Equals(stakeConfig.Mint, ProtocolConstants.SolanaMobileSkrMint, StringComparison.Ordinal)
            || !string.Equals(stakeConfig.StakeVault, derivedStakeVault, StringComparison.Ordinal))
        {
            return null;
        }

        var guardianPool = await TryLoadGuardianPoolAsync(ProtocolConstants.SolanaMobileSkrGuardianPoolAddress, cancellationToken);
        if (guardianPool is null
            || !string.Equals(guardianPool.StakeConfig, derivedStakeConfig, StringComparison.Ordinal))
        {
            return null;
        }

        var classification = new TokenAccountClassification(
            Classification: TokenAccountClassificationConstants.StakingVault,
            Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
            Confidence: TokenAccountClassificationConstants.Verified,
            Evidence: new[]
            {
                new TokenAccountClassificationEvidence("verified_program_id", ProtocolConstants.SolanaMobileSkrStakingProgramId),
                new TokenAccountClassificationEvidence("verified_stake_config", derivedStakeConfig),
                new TokenAccountClassificationEvidence("verified_stake_vault", derivedStakeVault),
                new TokenAccountClassificationEvidence("verified_guardian_pool", ProtocolConstants.SolanaMobileSkrGuardianPoolAddress),
                new TokenAccountClassificationEvidence("verified_stake_config_mint", stakeConfig.Mint),
                new TokenAccountClassificationEvidence("source_staking_idl", ProtocolConstants.SolanaMobileSkrStakingIdlSourceId)
            });

        return classification;
    }

    private async Task<ParsedSkrStakeConfigAccount?> TryLoadStakeConfigAsync(string stakeConfigAddress, CancellationToken cancellationToken)
    {
        try
        {
            var accountInfo = await _solanaAccountReader.GetAccountInfoAsync(stakeConfigAddress, cancellationToken);
            if (accountInfo is null
                || !string.Equals(accountInfo.OwnerProgramId, ProtocolConstants.SolanaMobileSkrStakingProgramId, StringComparison.Ordinal)
                || !SkrStakeConfigParser.TryParse(accountInfo.Data, out var parsed)
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

    private async Task<ParsedSkrGuardianPoolAccount?> TryLoadGuardianPoolAsync(string guardianPoolAddress, CancellationToken cancellationToken)
    {
        try
        {
            var accountInfo = await _solanaAccountReader.GetAccountInfoAsync(guardianPoolAddress, cancellationToken);
            if (accountInfo is null
                || !string.Equals(accountInfo.OwnerProgramId, ProtocolConstants.SolanaMobileSkrStakingProgramId, StringComparison.Ordinal)
                || !SkrGuardianPoolParser.TryParse(accountInfo.Data, out var parsed)
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

    private static bool TryDeriveProgramPdas(out string stakeConfigAddress, out string stakeVaultAddress)
    {
        stakeConfigAddress = string.Empty;
        stakeVaultAddress = string.Empty;

        if (!PublicKey.TryFindProgramAddress(
                new[]
                {
                    System.Text.Encoding.UTF8.GetBytes(ProtocolConstants.SolanaMobileSkrStakeConfigSeed)
                },
                new PublicKey(ProtocolConstants.SolanaMobileSkrStakingProgramId),
                out var stakeConfig,
                out _)
            || !PublicKey.TryFindProgramAddress(
                new[]
                {
                    System.Text.Encoding.UTF8.GetBytes(ProtocolConstants.SolanaMobileSkrStakeVaultSeed)
                },
                new PublicKey(ProtocolConstants.SolanaMobileSkrStakingProgramId),
                out var stakeVault,
                out _))
        {
            return false;
        }

        stakeConfigAddress = stakeConfig.Key;
        stakeVaultAddress = stakeVault.Key;
        return true;
    }

    private static bool IsSupportedTokenProgram(string? programId)
    {
        return string.Equals(programId, SolanaTokenConstants.SplTokenProgramId, StringComparison.Ordinal)
            || string.Equals(programId, SolanaTokenConstants.Token2022ProgramId, StringComparison.Ordinal);
    }
}
