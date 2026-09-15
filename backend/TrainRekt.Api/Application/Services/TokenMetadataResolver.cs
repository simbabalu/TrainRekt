using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Infrastructure.Helius;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenMetadataResolver : ITokenMetadataResolver
{
    private const ushort Token2022MetadataPointerExtensionType = 18;
    private const ushort Token2022TokenMetadataExtensionType = 19;
    private const int MetaplexMintFieldOffset = 33;

    private readonly IHeliusClient _heliusClient;

    public TokenMetadataResolver(IHeliusClient heliusClient)
    {
        _heliusClient = heliusClient;
    }

    public async Task<TokenMetadataResolution> ResolveAsync(
        string mint,
        string programId,
        byte[] mintAccountData,
        CancellationToken cancellationToken)
    {
        string? name = null;
        string? symbol = null;
        string? metadataUri = null;
        string? logoUri = null;
        bool? isFungibleByAsset = null;

        var dasMetadata = await TryLoadDasMetadataAsync(mint, cancellationToken);
        name = FirstNonEmpty(name, dasMetadata.Name);
        symbol = FirstNonEmpty(symbol, dasMetadata.Symbol);
        metadataUri = FirstNonEmpty(metadataUri, dasMetadata.MetadataUri);
        logoUri = FirstNonEmpty(logoUri, dasMetadata.LogoUri);
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

        return new TokenMetadataResolution(name, symbol, metadataUri, logoUri, isFungibleByAsset);
    }

    private async Task<(string? Name, string? Symbol, string? MetadataUri, string? LogoUri, bool? IsFungibleByAsset)> TryLoadDasMetadataAsync(
        string mint,
        CancellationToken cancellationToken)
    {
        try
        {
            using var assetResult = await _heliusClient.SendRpcRequestAsync(
                method: "getAsset",
                parameters:
                [
                    mint
                ],
                cancellationToken);

            var name = FirstNonEmpty(
                HeliusRpcResponseReader.TryGetNestedString(assetResult.RootElement, "result", "content", "metadata", "name"),
                HeliusRpcResponseReader.TryGetNestedString(assetResult.RootElement, "result", "token_info", "name"));

            var symbol = FirstNonEmpty(
                HeliusRpcResponseReader.TryGetNestedString(assetResult.RootElement, "result", "content", "metadata", "symbol"),
                HeliusRpcResponseReader.TryGetNestedString(assetResult.RootElement, "result", "token_info", "symbol"));

            var metadataUri = FirstNonEmpty(
                HeliusRpcResponseReader.TryGetNestedString(assetResult.RootElement, "result", "content", "json_uri"),
                HeliusRpcResponseReader.TryGetNestedString(assetResult.RootElement, "result", "metadata", "json_uri"));

            var logoUri = HeliusRpcResponseReader.TryGetNestedString(assetResult.RootElement, "result", "content", "links", "image");

            return (
                Name: name,
                Symbol: symbol,
                MetadataUri: metadataUri,
                LogoUri: logoUri,
                IsFungibleByAsset: TryInferFungibilityFromAsset(assetResult.RootElement)
            );
        }
        catch (HeliusRpcException)
        {
            return (null, null, null, null, null);
        }
        catch (InvalidOperationException)
        {
            return (null, null, null, null, null);
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

            if (!HeliusRpcResponseReader.TryReadAccountDataBytes(metadataAccountResult.RootElement, out var metadataAccountData))
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
                if (!HeliusRpcResponseReader.TryReadProgramAccountDataBytes(accountEntry, out var payload))
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

    private static bool? TryInferFungibilityFromAsset(JsonElement root)
    {
        var tokenStandard = HeliusRpcResponseReader.TryGetNestedString(root, "result", "token_info", "token_standard");
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

        var assetInterface = HeliusRpcResponseReader.TryGetNestedString(root, "result", "interface");
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

    private static string? FirstNonEmpty(string? first, string? second)
    {
        if (!string.IsNullOrWhiteSpace(first))
        {
            return first;
        }

        return string.IsNullOrWhiteSpace(second) ? null : second;
    }
}
