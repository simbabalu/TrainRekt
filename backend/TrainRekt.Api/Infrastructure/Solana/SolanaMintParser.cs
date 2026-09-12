using System.Buffers.Binary;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Infrastructure.Solana;

public sealed record ParsedMintAccount(
    string ProgramId,
    int Decimals,
    ulong Supply,
    string? MintAuthority,
    bool MintAuthorityRevoked,
    string? FreezeAuthority,
    bool FreezeAuthorityRevoked,
    IReadOnlyList<string> Token2022Extensions);

public static class SolanaMintParser
{
    private const ushort UninitializedExtensionType = 0;

    public static bool TryParse(string programId, ReadOnlySpan<byte> accountData, out ParsedMintAccount? parsed)
    {
        parsed = null;

        if (accountData.Length < SolanaTokenConstants.MintAccountBaseLengthBytes)
        {
            return false;
        }

        var mintAuthorityOption = BinaryPrimitives.ReadUInt32LittleEndian(accountData.Slice(0, 4));
        var mintAuthority = mintAuthorityOption == 0
            ? null
            : Base58Codec.Encode(accountData.Slice(4, 32));

        var supply = BinaryPrimitives.ReadUInt64LittleEndian(accountData.Slice(36, 8));
        var decimals = accountData[44];

        var freezeAuthorityOption = BinaryPrimitives.ReadUInt32LittleEndian(accountData.Slice(46, 4));
        var freezeAuthority = freezeAuthorityOption == 0
            ? null
            : Base58Codec.Encode(accountData.Slice(50, 32));

        var extensions = programId == SolanaTokenConstants.Token2022ProgramId
            ? ParseToken2022ExtensionKinds(accountData)
            : Array.Empty<string>();

        parsed = new ParsedMintAccount(
            ProgramId: programId,
            Decimals: decimals,
            Supply: supply,
            MintAuthority: mintAuthority,
            MintAuthorityRevoked: mintAuthority is null,
            FreezeAuthority: freezeAuthority,
            FreezeAuthorityRevoked: freezeAuthority is null,
            Token2022Extensions: extensions);

        return true;
    }

    public static IReadOnlyDictionary<ushort, byte[]> ParseToken2022ExtensionPayloads(ReadOnlySpan<byte> accountData)
    {
        var result = new Dictionary<ushort, byte[]>();
        if (accountData.Length <= SolanaTokenConstants.MintAccountBaseLengthBytes)
        {
            return result;
        }

        if (accountData.Length <= SolanaTokenConstants.Token2022MintAccountTypeOffset)
        {
            return result;
        }

        if (accountData[SolanaTokenConstants.Token2022MintAccountTypeOffset] != SolanaTokenConstants.Token2022MintAccountType)
        {
            return result;
        }

        var extensionData = accountData.Slice(SolanaTokenConstants.Token2022MintAccountTypeOffset + 1);
        var offset = 0;

        while (offset + 2 <= extensionData.Length)
        {
            var extensionType = BinaryPrimitives.ReadUInt16LittleEndian(extensionData.Slice(offset, 2));
            if (extensionType == UninitializedExtensionType)
            {
                break;
            }

            if (offset + 4 > extensionData.Length)
            {
                break;
            }

            var length = BinaryPrimitives.ReadUInt16LittleEndian(extensionData.Slice(offset + 2, 2));
            var valueOffset = offset + 4;
            var valueEnd = valueOffset + length;
            if (valueEnd > extensionData.Length)
            {
                break;
            }

            if (!result.ContainsKey(extensionType))
            {
                result[extensionType] = extensionData.Slice(valueOffset, length).ToArray();
            }

            offset = valueEnd;
        }

        return result;
    }

    private static IReadOnlyList<string> ParseToken2022ExtensionKinds(ReadOnlySpan<byte> accountData)
    {
        var payloads = ParseToken2022ExtensionPayloads(accountData);
        if (payloads.Count == 0)
        {
            return Array.Empty<string>();
        }

        var extensionKinds = new List<string>(payloads.Count);
        foreach (var extensionType in payloads.Keys)
        {
            extensionKinds.Add(MapToken2022Extension(extensionType));
        }

        return extensionKinds;
    }

    private static string MapToken2022Extension(ushort extensionType)
    {
        return extensionType switch
        {
            0 => "uninitialized",
            1 => "transfer-fee-config",
            2 => "transfer-fee-amount",
            3 => "mint-close-authority",
            4 => "confidential-transfer-mint",
            5 => "confidential-transfer-account",
            6 => "default-account-state",
            7 => "immutable-owner",
            8 => "memo-transfer",
            9 => "non-transferable",
            10 => "interest-bearing-config",
            11 => "cpi-guard",
            12 => "permanent-delegate",
            13 => "non-transferable-account",
            14 => "transfer-hook",
            15 => "transfer-hook-account",
            16 => "confidential-transfer-fee-config",
            17 => "confidential-transfer-fee-amount",
            18 => "metadata-pointer",
            19 => "token-metadata",
            20 => "group-pointer",
            21 => "token-group",
            22 => "group-member-pointer",
            23 => "token-group-member",
            24 => "confidential-mint-burn",
            25 => "scaled-ui-amount",
            26 => "pausable",
            27 => "pausable-account",
            28 => "permissioned-burn",
            _ => $"extension-{extensionType}"
        };
    }
}
