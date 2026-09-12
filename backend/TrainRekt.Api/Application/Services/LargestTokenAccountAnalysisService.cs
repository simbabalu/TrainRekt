using Solnet.Programs;
using Solnet.Wallet;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Infrastructure.Helius;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Application.Services;

public sealed class LargestTokenAccountAnalysisService : ILargestTokenAccountAnalysisService
{
    private const string UnknownConcentrationSemantics = "Unknown concentration reflects token accounts in the reported largest-account sample that could not be deterministically linked to a known protocol role.";
    private const int LargestTokenAccountsAnalysisLimit = 10;
    private const int PumpFunBondingCurveCompleteOffset = 48;

    private readonly IHeliusClient _heliusClient;
    private readonly ITokenAccountClassificationService _tokenAccountClassificationService;

    public LargestTokenAccountAnalysisService(
        IHeliusClient heliusClient,
        ITokenAccountClassificationService tokenAccountClassificationService)
    {
        _heliusClient = heliusClient;
        _tokenAccountClassificationService = tokenAccountClassificationService;
    }

    public async Task<LargestTokenAccountsAnalysis?> AnalyzeAsync(
        string mint,
        string mintProgramId,
        ulong mintSupply,
        CancellationToken cancellationToken)
    {
        using var largestAccountsResult = await _heliusClient.SendRpcRequestAsync(
            method: "getTokenLargestAccounts",
            parameters:
            [
                mint,
                new { commitment = "confirmed" }
            ],
            cancellationToken);

        if (!HeliusRpcResponseReader.TryGetLargestAccounts(largestAccountsResult.RootElement, out var largestAccounts))
        {
            return null;
        }

        var largestAccountBalances = largestAccounts
            .Select(static account => account.AmountRaw)
            .ToArray();

        var classificationRequestContext = await BuildClassificationRequestContextAsync(mint, mintProgramId, cancellationToken);
        var largestTokenAccounts = await AnalyzeLargestTokenAccountsAsync(
            largestAccounts,
            mintSupply,
            classificationRequestContext,
            cancellationToken);

        return new LargestTokenAccountsAnalysis(
            LargestAccountBalances: largestAccountBalances,
            LargestTokenAccounts: largestTokenAccounts,
            PumpFunContext: BuildPumpFunContext(classificationRequestContext, largestTokenAccounts),
            UnclassifiedTokenAccountConcentration: BuildUnclassifiedConcentration(largestTokenAccounts));
    }

    private async Task<TokenAccountClassificationRequestContext> BuildClassificationRequestContextAsync(
        string mint,
        string mintProgramId,
        CancellationToken cancellationToken)
    {
        var pumpFun = await TryBuildPumpFunDerivationAsync(mint, mintProgramId, cancellationToken);
        return new TokenAccountClassificationRequestContext(
            Mint: mint,
            MintProgramId: mintProgramId,
            PumpFun: pumpFun);
    }

    private async Task<PumpFunDerivation?> TryBuildPumpFunDerivationAsync(
        string mint,
        string mintProgramId,
        CancellationToken cancellationToken)
    {
        try
        {
            var mintKey = new PublicKey(mint);
            var pumpProgramId = new PublicKey(ProtocolConstants.PumpFunProgramId);

            if (!PublicKey.TryFindProgramAddress(
                    new[]
                    {
                        System.Text.Encoding.UTF8.GetBytes(ProtocolConstants.PumpFunBondingCurveSeed),
                        mintKey.KeyBytes
                    },
                    pumpProgramId,
                    out var bondingCurveAddress,
                    out _))
            {
                return null;
            }

            var tokenProgramId = new PublicKey(mintProgramId);
            if (!PublicKey.TryFindProgramAddress(
                    new[]
                    {
                        bondingCurveAddress.KeyBytes,
                        tokenProgramId.KeyBytes,
                        mintKey.KeyBytes
                    },
                    AssociatedTokenAccountProgram.ProgramIdKey,
                    out var bondingCurveTokenAccount,
                    out _))
            {
                return null;
            }

            var bondingCurveAddressText = bondingCurveAddress.Key;
            var bondingCurveTokenAccountText = bondingCurveTokenAccount.Key;

            using var accountInfoResult = await _heliusClient.SendRpcRequestAsync(
                method: "getAccountInfo",
                parameters:
                [
                    bondingCurveAddressText,
                    new { encoding = "base64", commitment = "confirmed" }
                ],
                cancellationToken);

            if (!HeliusRpcResponseReader.TryReadGenericAccountInfo(accountInfoResult.RootElement, out var accountOwner, out var accountData))
            {
                return new PumpFunDerivation(
                    ProgramId: ProtocolConstants.PumpFunProgramId,
                    BondingCurveAddress: bondingCurveAddressText,
                    BondingCurveTokenAccount: bondingCurveTokenAccountText,
                    BondingCurveAccountVerified: false,
                    Complete: null);
            }

            var ownerMatches = string.Equals(accountOwner, ProtocolConstants.PumpFunProgramId, StringComparison.Ordinal);
            var complete = ownerMatches && TryParsePumpFunCompleteFlag(accountData, out var completeValue)
                ? (bool?)completeValue
                : null;

            return new PumpFunDerivation(
                ProgramId: ProtocolConstants.PumpFunProgramId,
                BondingCurveAddress: bondingCurveAddressText,
                BondingCurveTokenAccount: bondingCurveTokenAccountText,
                BondingCurveAccountVerified: ownerMatches,
                Complete: complete);
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

    private async Task<IReadOnlyList<AnalyzedTokenAccount>> AnalyzeLargestTokenAccountsAsync(
        IReadOnlyList<LargestTokenAccountEntry> largestAccounts,
        ulong supply,
        TokenAccountClassificationRequestContext requestContext,
        CancellationToken cancellationToken)
    {
        var limitedAccounts = largestAccounts.Take(LargestTokenAccountsAnalysisLimit).ToArray();
        var accountCache = new Dictionary<string, (string OwnerProgramId, byte[] Data)>(StringComparer.Ordinal);
        var analyzed = new List<AnalyzedTokenAccount>(limitedAccounts.Length);

        foreach (var account in limitedAccounts)
        {
            cancellationToken.ThrowIfCancellationRequested();

            ParsedTokenAccount? parsedTokenAccount = null;
            string? tokenProgramId = null;

            if (!string.IsNullOrWhiteSpace(account.Address)
                && await TryGetTokenAccountInfoAsync(account.Address, accountCache, cancellationToken) is { } accountInfo
                && SolanaTokenAccountParser.TryParse(accountInfo.OwnerProgramId, accountInfo.Data, out var parsed)
                && parsed is not null)
            {
                parsedTokenAccount = parsed;
                tokenProgramId = accountInfo.OwnerProgramId;
            }

            var percentage = CalculatePercentage(supply, account.AmountRaw);
            var classificationContext = new TokenAccountClassificationContext(
                Request: requestContext,
                TokenAccountAddress: account.Address,
                TokenAccountMint: parsedTokenAccount?.Mint,
                TokenAccountAuthority: parsedTokenAccount?.Authority,
                TokenAccountProgramId: tokenProgramId,
                TokenAccountAmountRaw: account.AmountRaw,
                PercentageOfSupply: percentage);

            var classification = await _tokenAccountClassificationService.ClassifyAsync(classificationContext, cancellationToken);

            analyzed.Add(new AnalyzedTokenAccount(
                Address: account.Address,
                Authority: parsedTokenAccount?.Authority,
                Mint: parsedTokenAccount?.Mint,
                TokenProgram: tokenProgramId,
                RawAmount: account.AmountRaw.ToString(),
                Percentage: percentage,
                Classification: classification));
        }

        return analyzed;
    }

    private async Task<(string OwnerProgramId, byte[] Data)?> TryGetTokenAccountInfoAsync(
        string accountAddress,
        IDictionary<string, (string OwnerProgramId, byte[] Data)> cache,
        CancellationToken cancellationToken)
    {
        if (cache.TryGetValue(accountAddress, out var cached))
        {
            return cached;
        }

        try
        {
            using var accountInfo = await _heliusClient.SendRpcRequestAsync(
                method: "getAccountInfo",
                parameters:
                [
                    accountAddress,
                    new { encoding = "base64", commitment = "confirmed" }
                ],
                cancellationToken);

            if (!HeliusRpcResponseReader.TryReadGenericAccountInfo(accountInfo.RootElement, out var ownerProgramId, out var data))
            {
                return null;
            }

            var value = (ownerProgramId, data);
            cache[accountAddress] = value;
            return value;
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

    private static UnclassifiedTokenAccountConcentration BuildUnclassifiedConcentration(
        IReadOnlyList<AnalyzedTokenAccount> largestTokenAccounts)
    {
        static bool IsUnknown(AnalyzedTokenAccount account)
        {
            return string.Equals(
                account.Classification.Classification,
                TokenAccountClassificationConstants.Unknown,
                StringComparison.Ordinal);
        }

        var classifiedProtocolPercentage = largestTokenAccounts
            .Where(static account => account.Classification.Protocol is not null)
            .Sum(static account => account.Percentage ?? 0m);

        var unknownAccounts = largestTokenAccounts
            .Where(IsUnknown)
            .OrderByDescending(static account => ulong.TryParse(account.RawAmount, out var value) ? value : 0UL)
            .ToArray();

        var unknownPercentage = unknownAccounts.Sum(static account => account.Percentage ?? 0m);
        var largestUnknown = unknownAccounts.FirstOrDefault()?.Percentage;
        var top5Unknown = unknownAccounts.Take(5).Sum(static account => account.Percentage ?? 0m);

        return new UnclassifiedTokenAccountConcentration(
            ClassifiedProtocolPercentage: Math.Round(classifiedProtocolPercentage, 4, MidpointRounding.AwayFromZero),
            UnknownPercentageWithinReportedLargestAccounts: Math.Round(unknownPercentage, 4, MidpointRounding.AwayFromZero),
            LargestUnknownTokenAccountPercentage: largestUnknown,
            Top5UnknownTokenAccountsPercentage: Math.Round(top5Unknown, 4, MidpointRounding.AwayFromZero),
            SemanticsNote: UnknownConcentrationSemantics);
    }

    private static PumpFunContext? BuildPumpFunContext(
        TokenAccountClassificationRequestContext requestContext,
        IReadOnlyList<AnalyzedTokenAccount> largestTokenAccounts)
    {
        if (requestContext.PumpFun is null)
        {
            return null;
        }

        var detected = largestTokenAccounts.Any(account =>
            string.Equals(account.Classification.Protocol, ProtocolConstants.PumpFunProtocolName, StringComparison.Ordinal)
            && string.Equals(account.Classification.Classification, TokenAccountClassificationConstants.BondingCurve, StringComparison.Ordinal));

        return new PumpFunContext(
            Protocol: ProtocolConstants.PumpFunProtocolName,
            BondingCurveDetected: detected,
            BondingCurveAddress: requestContext.PumpFun.BondingCurveAddress,
            BondingCurveTokenAccount: requestContext.PumpFun.BondingCurveTokenAccount,
            Complete: requestContext.PumpFun.Complete);
    }

    private static decimal? CalculatePercentage(ulong supply, ulong part)
    {
        if (supply == 0)
        {
            return null;
        }

        return Math.Round((part * 100m) / supply, 4, MidpointRounding.AwayFromZero);
    }

    private static bool TryParsePumpFunCompleteFlag(byte[] data, out bool complete)
    {
        complete = false;

        var discriminator = GetPumpFunBondingCurveDiscriminator();
        if (data.Length <= PumpFunBondingCurveCompleteOffset
            || !data.AsSpan(0, discriminator.Length).SequenceEqual(discriminator))
        {
            return false;
        }

        var completeByte = data[PumpFunBondingCurveCompleteOffset];
        if (completeByte is > 1)
        {
            return false;
        }

        complete = completeByte == 1;
        return true;
    }

    private static ReadOnlySpan<byte> GetPumpFunBondingCurveDiscriminator()
    {
        Span<byte> fullHash = stackalloc byte[32];
        System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("account:BondingCurve"), fullHash);
        return fullHash.Slice(0, 8).ToArray();
    }
}
