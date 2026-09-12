using System.Text.Json;
using Solnet.Programs;
using Solnet.Wallet;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Analysis;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenInspectionService : ITokenInspectionDeterministicService
{
    private const string HolderConcentrationSemantics = "Largest token account concentration based on getTokenLargestAccounts token-account balances. These percentages are not verified beneficial-owner concentration.";
    private const string UnknownConcentrationSemantics = "Unknown concentration reflects token accounts in the reported largest-account sample that could not be deterministically linked to a known protocol role.";
    private const int LargestTokenAccountsAnalysisLimit = 10;

    private const ushort Token2022MetadataPointerExtensionType = 18;
    private const ushort Token2022TokenMetadataExtensionType = 19;
    private const int MetaplexMintFieldOffset = 33;
    private const int PumpFunBondingCurveCompleteOffset = 48;

    private readonly IHeliusClient _heliusClient;
    private readonly ITokenAccountClassificationService _tokenAccountClassificationService;

    public TokenInspectionService(IHeliusClient heliusClient)
        : this(heliusClient, new TokenAccountClassificationService(Array.Empty<ITokenAccountClassifier>()))
    {
    }

    public TokenInspectionService(
        IHeliusClient heliusClient,
        ITokenAccountClassificationService tokenAccountClassificationService)
    {
        _heliusClient = heliusClient;
        _tokenAccountClassificationService = tokenAccountClassificationService;
    }

    public async Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
    {
        if (!SolanaPublicKeyValidator.TryNormalize(mint, out var normalizedMint))
        {
            return TokenInspectionResult.Failure(
                TokenInspectionErrorCode.InvalidMint,
                "The provided mint is not a syntactically valid Solana public key.");
        }

        try
        {
            using var accountInfoResult = await _heliusClient.SendRpcRequestAsync(
                method: "getAccountInfo",
                parameters:
                [
                    normalizedMint,
                    new { encoding = "base64", commitment = "confirmed" }
                ],
                cancellationToken);

            if (!TryGetAccountInfo(accountInfoResult.RootElement, out var ownerProgramId, out var accountDataBytes, out var accountInfoError))
            {
                if (accountInfoError == TokenInspectionErrorCode.MintNotFound)
                {
                    return TokenInspectionResult.Failure(TokenInspectionErrorCode.MintNotFound, "Mint account was not found.");
                }

                if (accountInfoError == TokenInspectionErrorCode.NotFungibleTokenMint)
                {
                    return TokenInspectionResult.Failure(TokenInspectionErrorCode.NotFungibleTokenMint, "The address does not belong to SPL Token or Token-2022 mint ownership.");
                }

                return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderMalformedResponse, "RPC response did not include valid mint account data.");
            }

            if (!SolanaMintParser.TryParse(ownerProgramId, accountDataBytes, out var parsedMint) || parsedMint is null)
            {
                return TokenInspectionResult.Failure(TokenInspectionErrorCode.NotFungibleTokenMint, "The account does not decode as a fungible token mint.");
            }

            using var largestAccountsResult = await _heliusClient.SendRpcRequestAsync(
                method: "getTokenLargestAccounts",
                parameters:
                [
                    normalizedMint,
                    new { commitment = "confirmed" }
                ],
                cancellationToken);

            if (!TryGetLargestAccounts(largestAccountsResult.RootElement, out var largestAccounts))
            {
                return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderMalformedResponse, "RPC response did not include valid largest-token-account balances.");
            }

            var largestAccountBalances = largestAccounts
                .Select(static account => account.AmountRaw)
                .ToArray();

            var classificationRequestContext = await BuildClassificationRequestContextAsync(
                mint: normalizedMint,
                mintProgramId: ownerProgramId,
                cancellationToken);

            var largestTokenAccounts = await AnalyzeLargestTokenAccountsAsync(
                largestAccounts,
                parsedMint.Supply,
                classificationRequestContext,
                cancellationToken);

            var metadata = await TryLoadTokenMetadataAsync(normalizedMint, ownerProgramId, accountDataBytes, cancellationToken);

            if (!IsFungibleMint(parsedMint, metadata.IsFungibleByAsset))
            {
                return TokenInspectionResult.Failure(
                    TokenInspectionErrorCode.NotFungibleTokenMint,
                    "The supplied address does not appear to represent a fungible token mint.");
            }

            var (top1, top5, top10) = HolderConcentrationAnalyzer.Calculate(parsedMint.Supply, largestAccountBalances);

            var identity = new TokenIdentity(
                Mint: normalizedMint,
                Name: metadata.Name,
                Symbol: metadata.Symbol,
                Decimals: parsedMint.Decimals,
                SupplyRaw: parsedMint.Supply.ToString(),
                ProgramId: ownerProgramId,
                MetadataUri: metadata.MetadataUri);

            var authorities = new TokenAuthorities(
                MintAuthority: parsedMint.MintAuthority,
                MintAuthorityRevoked: parsedMint.MintAuthorityRevoked,
                FreezeAuthority: parsedMint.FreezeAuthority,
                FreezeAuthorityRevoked: parsedMint.FreezeAuthorityRevoked);

            var program = new TokenProgramInfo(
                ProgramType: ownerProgramId == SolanaTokenConstants.Token2022ProgramId ? "token-2022" : "spl-token",
                ProgramId: ownerProgramId,
                Token2022Extensions: parsedMint.Token2022Extensions);

            var age = new TokenAgeInfo(
                AgeSeconds: null,
                InferredCreatedAtUtc: null,
                IsReliable: false,
                UnavailableReason: "Reliable mint-creation time is not derived in this MVP because it would require historical signature scanning that can be expensive and ambiguous.");

            var concentration = new HolderConcentration(
                TopHolderPercentage: top1,
                Top5HoldersPercentage: top5,
                Top10HoldersPercentage: top10,
                SemanticsNote: HolderConcentrationSemantics,
                UnclassifiedTokenAccountConcentration: BuildUnclassifiedConcentration(largestTokenAccounts));

            var pumpFunContext = BuildPumpFunContext(classificationRequestContext, largestTokenAccounts);

            var baseInspection = new TokenInspection(
                Identity: identity,
                Authorities: authorities,
                Program: program,
                Age: age,
                HolderConcentration: concentration,
                LargestTokenAccounts: largestTokenAccounts,
                PumpFunContext: pumpFunContext,
                ReviewSignals: Array.Empty<TokenReviewSignal>(),
                InspectedAtUtc: DateTimeOffset.UtcNow);

            var reviewSignals = TokenReviewSignalFactory.Create(baseInspection);
            var inspection = baseInspection with { ReviewSignals = reviewSignals };

            return TokenInspectionResult.Success(inspection);
        }
        catch (OperationCanceledException)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.Cancelled, "The token inspection request was cancelled.");
        }
        catch (HeliusRpcException exception) when (exception.Kind is HeliusRpcFailureKind.Transport or HeliusRpcFailureKind.RateLimited)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderUnavailable, "Helius RPC is temporarily unavailable. Please try again.");
        }
        catch (HeliusRpcException exception) when (exception.Kind == HeliusRpcFailureKind.ProviderError)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderRejectedRequest, "Helius RPC rejected the token-inspection request payload.");
        }
        catch (InvalidOperationException)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderUnavailable, "Helius configuration is missing for this endpoint.");
        }
        catch (HeliusRpcException)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderMalformedResponse, "Helius RPC returned malformed data.");
        }
        catch (Exception)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderMalformedResponse, "Token inspection failed due to unexpected provider data.");
        }
    }

    private async Task<(string? Name, string? Symbol, string? MetadataUri, bool? IsFungibleByAsset)> TryLoadTokenMetadataAsync(
        string mint,
        string programId,
        byte[] mintAccountData,
        CancellationToken cancellationToken)
    {
        string? name = null;
        string? symbol = null;
        string? metadataUri = null;
        bool? isFungibleByAsset = null;

        var dasMetadata = await TryLoadDasMetadataAsync(mint, cancellationToken);
        name = FirstNonEmpty(name, dasMetadata.Name);
        symbol = FirstNonEmpty(symbol, dasMetadata.Symbol);
        metadataUri = FirstNonEmpty(metadataUri, dasMetadata.MetadataUri);
        isFungibleByAsset = dasMetadata.IsFungibleByAsset;

        if (programId == SolanaTokenConstants.Token2022ProgramId)
        {
            var token2022Metadata = await TryLoadToken2022MetadataAsync(mint, mintAccountData, cancellationToken);
            name = FirstNonEmpty(name, token2022Metadata.Name);
            symbol = FirstNonEmpty(symbol, token2022Metadata.Symbol);
            metadataUri = FirstNonEmpty(metadataUri, token2022Metadata.MetadataUri);
        }

        if (name is null || symbol is null || metadataUri is null)
        {
            var metaplexMetadata = await TryLoadMetaplexMetadataAsync(mint, cancellationToken);
            name = FirstNonEmpty(name, metaplexMetadata.Name);
            symbol = FirstNonEmpty(symbol, metaplexMetadata.Symbol);
            metadataUri = FirstNonEmpty(metadataUri, metaplexMetadata.MetadataUri);
        }

        return (name, symbol, metadataUri, isFungibleByAsset);
    }

    private async Task<(string? Name, string? Symbol, string? MetadataUri, bool? IsFungibleByAsset)> TryLoadDasMetadataAsync(
        string mint,
        CancellationToken cancellationToken)
    {
        try
        {
            using var assetResult = await _heliusClient.SendRpcRequestAsync(
                method: "getAsset",
                parameters:
                [
                    new { id = mint }
                ],
                cancellationToken);

            var symbol = FirstNonEmpty(
                TryGetNestedString(assetResult.RootElement, "result", "content", "metadata", "symbol"),
                TryGetNestedString(assetResult.RootElement, "result", "token_info", "symbol"));

            var metadataUri = FirstNonEmpty(
                TryGetNestedString(assetResult.RootElement, "result", "content", "json_uri"),
                TryGetNestedString(assetResult.RootElement, "result", "metadata", "json_uri"));

            return (
                Name: TryGetNestedString(assetResult.RootElement, "result", "content", "metadata", "name"),
                Symbol: symbol,
                MetadataUri: metadataUri,
                IsFungibleByAsset: TryInferFungibilityFromAsset(assetResult.RootElement)
            );
        }
        catch (HeliusRpcException)
        {
            return (null, null, null, null);
        }
        catch (InvalidOperationException)
        {
            return (null, null, null, null);
        }
    }

    private async Task<(string? Name, string? Symbol, string? MetadataUri)> TryLoadToken2022MetadataAsync(
        string mint,
        byte[] mintAccountData,
        CancellationToken cancellationToken)
    {
        try
        {
            var extensionPayloads = SolanaMintParser.ParseToken2022ExtensionPayloads(mintAccountData);

            if (extensionPayloads.TryGetValue(Token2022TokenMetadataExtensionType, out var tokenMetadataPayload)
                && TokenMetadataParser.TryParseToken2022TokenMetadata(
                    tokenMetadataPayload,
                    out var tokenMetadataMint,
                    out var inlineName,
                    out var inlineSymbol,
                    out var inlineUri)
                && string.Equals(tokenMetadataMint, mint, StringComparison.Ordinal))
            {
                return (inlineName, inlineSymbol, inlineUri);
            }

            if (!extensionPayloads.TryGetValue(Token2022MetadataPointerExtensionType, out var pointerPayload)
                || !TokenMetadataParser.TryParseToken2022MetadataPointer(pointerPayload, out var metadataPointer)
                || string.IsNullOrWhiteSpace(metadataPointer)
                || string.Equals(metadataPointer, mint, StringComparison.Ordinal))
            {
                return (null, null, null);
            }

            using var metadataAccountResult = await _heliusClient.SendRpcRequestAsync(
                method: "getAccountInfo",
                parameters:
                [
                    metadataPointer,
                    new { encoding = "base64", commitment = "confirmed" }
                ],
                cancellationToken);

            if (!TryReadAccountDataBytes(metadataAccountResult.RootElement, out var metadataAccountData))
            {
                return (null, null, null);
            }

            if (!TokenMetadataParser.TryParseToken2022TokenMetadata(
                    metadataAccountData,
                    out var pointedMint,
                    out var pointedName,
                    out var pointedSymbol,
                    out var pointedUri)
                || !string.Equals(pointedMint, mint, StringComparison.Ordinal))
            {
                return (null, null, null);
            }

            return (pointedName, pointedSymbol, pointedUri);
        }
        catch (HeliusRpcException)
        {
            return (null, null, null);
        }
        catch (InvalidOperationException)
        {
            return (null, null, null);
        }
    }

    private async Task<(string? Name, string? Symbol, string? MetadataUri)> TryLoadMetaplexMetadataAsync(
        string mint,
        CancellationToken cancellationToken)
    {
        try
        {
            using var metadataAccountsResult = await _heliusClient.SendRpcRequestAsync(
                method: "getProgramAccounts",
                parameters:
                [
                    SolanaTokenConstants.MetaplexMetadataProgramId,
                    new
                    {
                        encoding = "base64",
                        commitment = "confirmed",
                        filters = new object[]
                        {
                            new { memcmp = new { offset = MetaplexMintFieldOffset, bytes = mint } }
                        }
                    }
                ],
                cancellationToken);

            if (!metadataAccountsResult.RootElement.TryGetProperty("result", out var result)
                || result.ValueKind != JsonValueKind.Array)
            {
                return (null, null, null);
            }

            foreach (var accountEntry in result.EnumerateArray())
            {
                if (!TryReadProgramAccountDataBytes(accountEntry, out var payload))
                {
                    continue;
                }

                if (!TokenMetadataParser.TryParseMetaplexMetadata(
                        payload,
                        out var parsedMint,
                        out var parsedName,
                        out var parsedSymbol,
                        out var parsedUri)
                    || !string.Equals(parsedMint, mint, StringComparison.Ordinal))
                {
                    continue;
                }

                return (parsedName, parsedSymbol, parsedUri);
            }

            return (null, null, null);
        }
        catch (HeliusRpcException)
        {
            return (null, null, null);
        }
        catch (InvalidOperationException)
        {
            return (null, null, null);
        }
    }

    private static bool IsFungibleMint(ParsedMintAccount parsedMint, bool? fungibleByAsset)
    {
        if (fungibleByAsset is not null)
        {
            return fungibleByAsset.Value;
        }

        return !(parsedMint.Decimals == 0 && parsedMint.Supply <= 1UL);
    }

    private static bool? TryInferFungibilityFromAsset(JsonElement root)
    {
        var tokenStandard = TryGetNestedString(root, "result", "token_info", "token_standard");
        if (!string.IsNullOrWhiteSpace(tokenStandard))
        {
            if (tokenStandard.Contains("non", StringComparison.OrdinalIgnoreCase)
                && tokenStandard.Contains("fungible", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (tokenStandard.Contains("fungible", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        var assetInterface = TryGetNestedString(root, "result", "interface");
        if (!string.IsNullOrWhiteSpace(assetInterface))
        {
            if (assetInterface.Contains("non", StringComparison.OrdinalIgnoreCase)
                && assetInterface.Contains("fungible", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (assetInterface.Contains("fungible", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return null;
    }

    private static bool TryGetAccountInfo(
        JsonElement root,
        out string ownerProgramId,
        out byte[] data,
        out TokenInspectionErrorCode errorCode)
    {
        ownerProgramId = string.Empty;
        data = Array.Empty<byte>();
        errorCode = TokenInspectionErrorCode.ProviderMalformedResponse;

        if (!root.TryGetProperty("result", out var result) || !result.TryGetProperty("value", out var value))
        {
            return false;
        }

        if (value.ValueKind == JsonValueKind.Null)
        {
            errorCode = TokenInspectionErrorCode.MintNotFound;
            return false;
        }

        if (!value.TryGetProperty("owner", out var ownerElement) || ownerElement.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        ownerProgramId = ownerElement.GetString() ?? string.Empty;
        if (ownerProgramId != SolanaTokenConstants.SplTokenProgramId && ownerProgramId != SolanaTokenConstants.Token2022ProgramId)
        {
            errorCode = TokenInspectionErrorCode.NotFungibleTokenMint;
            return false;
        }

        if (!value.TryGetProperty("data", out var dataElement) || dataElement.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        if (dataElement.GetArrayLength() < 2)
        {
            return false;
        }

        var base64 = dataElement[0].GetString();
        var encoding = dataElement[1].GetString();

        if (!string.Equals(encoding, "base64", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(base64))
        {
            return false;
        }

        try
        {
            data = Convert.FromBase64String(base64);
        }
        catch (FormatException)
        {
            return false;
        }

        return true;
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

            if (!TryReadGenericAccountInfo(accountInfoResult.RootElement, out var accountOwner, out var accountData))
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
        catch (Exception)
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

            if (!TryReadGenericAccountInfo(accountInfo.RootElement, out var ownerProgramId, out var data))
            {
                return null;
            }

            var value = (ownerProgramId, data);
            cache[accountAddress] = value;
            return value;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static HolderConcentration BuildUnclassifiedConcentrationHolder(
        decimal? top1,
        decimal? top5,
        decimal? top10,
        IReadOnlyList<AnalyzedTokenAccount> largestTokenAccounts)
    {
        return new HolderConcentration(
            TopHolderPercentage: top1,
            Top5HoldersPercentage: top5,
            Top10HoldersPercentage: top10,
            SemanticsNote: HolderConcentrationSemantics,
            UnclassifiedTokenAccountConcentration: BuildUnclassifiedConcentration(largestTokenAccounts));
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

    private static bool TryGetLargestAccounts(JsonElement root, out IReadOnlyList<LargestTokenAccountEntry> balances)
    {
        balances = Array.Empty<LargestTokenAccountEntry>();

        if (!root.TryGetProperty("result", out var result)
            || !result.TryGetProperty("value", out var value)
            || value.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        var parsed = new List<LargestTokenAccountEntry>();
        foreach (var item in value.EnumerateArray())
        {
            if (!item.TryGetProperty("amount", out var amountElement) || amountElement.ValueKind != JsonValueKind.String)
            {
                return false;
            }

            var amountRaw = amountElement.GetString();
            if (!ulong.TryParse(amountRaw, out var amount))
            {
                return false;
            }

            var address = item.TryGetProperty("address", out var addressElement) && addressElement.ValueKind == JsonValueKind.String
                ? addressElement.GetString() ?? string.Empty
                : string.Empty;

            parsed.Add(new LargestTokenAccountEntry(address, amount));
        }

        balances = parsed;
        return true;
    }

    private static bool TryReadGenericAccountInfo(JsonElement root, out string ownerProgramId, out byte[] data)
    {
        ownerProgramId = string.Empty;
        data = Array.Empty<byte>();

        if (!root.TryGetProperty("result", out var result)
            || !result.TryGetProperty("value", out var value)
            || value.ValueKind == JsonValueKind.Null)
        {
            return false;
        }

        if (!value.TryGetProperty("owner", out var ownerElement) || ownerElement.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        if (!TryReadAccountDataBytes(root, out data))
        {
            return false;
        }

        ownerProgramId = ownerElement.GetString() ?? string.Empty;
        return !string.IsNullOrWhiteSpace(ownerProgramId);
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

    private sealed record LargestTokenAccountEntry(string Address, ulong AmountRaw);

    private static bool TryReadAccountDataBytes(JsonElement root, out byte[] data)
    {
        data = Array.Empty<byte>();

        if (!root.TryGetProperty("result", out var result)
            || !result.TryGetProperty("value", out var value)
            || value.ValueKind == JsonValueKind.Null)
        {
            return false;
        }

        if (!value.TryGetProperty("data", out var dataElement)
            || dataElement.ValueKind != JsonValueKind.Array
            || dataElement.GetArrayLength() < 2)
        {
            return false;
        }

        var base64 = dataElement[0].GetString();
        var encoding = dataElement[1].GetString();
        if (string.IsNullOrWhiteSpace(base64)
            || !string.Equals(encoding, "base64", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        try
        {
            data = Convert.FromBase64String(base64);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool TryReadProgramAccountDataBytes(JsonElement programAccountEntry, out byte[] data)
    {
        data = Array.Empty<byte>();

        if (!programAccountEntry.TryGetProperty("account", out var account)
            || !account.TryGetProperty("data", out var dataElement)
            || dataElement.ValueKind != JsonValueKind.Array
            || dataElement.GetArrayLength() < 2)
        {
            return false;
        }

        var base64 = dataElement[0].GetString();
        var encoding = dataElement[1].GetString();
        if (string.IsNullOrWhiteSpace(base64)
            || !string.Equals(encoding, "base64", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        try
        {
            data = Convert.FromBase64String(base64);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static string? FirstNonEmpty(string? first, string? second)
    {
        if (!string.IsNullOrWhiteSpace(first))
        {
            return first;
        }

        return string.IsNullOrWhiteSpace(second) ? null : second;
    }

    private static string? TryGetNestedString(JsonElement root, params string[] path)
    {
        var current = root;
        foreach (var segment in path)
        {
            if (!current.TryGetProperty(segment, out current))
            {
                return null;
            }
        }

        return current.ValueKind == JsonValueKind.String ? current.GetString() : null;
    }
}
