using System.Buffers.Binary;
using System.Text;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Infrastructure.Solana;

public static class TokenMetadataParser
{
    public static bool TryParseToken2022MetadataPointer(ReadOnlySpan<byte> payload, out string? metadataAddress)
    {
        metadataAddress = null;

        if (payload.Length < 64)
        {
            return false;
        }

        var metadataAddressBytes = payload.Slice(32, 32);
        if (IsAllZeros(metadataAddressBytes))
        {
            return true;
        }

        metadataAddress = Base58Codec.Encode(metadataAddressBytes);
        return true;
    }

    public static bool TryParseToken2022TokenMetadata(
        ReadOnlySpan<byte> payload,
        out string? mint,
        out string? name,
        out string? symbol,
        out string? uri)
    {
        mint = null;
        name = null;
        symbol = null;
        uri = null;

        if (payload.Length < 64)
        {
            return false;
        }

        mint = Base58Codec.Encode(payload.Slice(32, 32));
        var offset = 64;

        if (!TryReadBorshString(payload, ref offset, out name)
            || !TryReadBorshString(payload, ref offset, out symbol)
            || !TryReadBorshString(payload, ref offset, out uri))
        {
            mint = null;
            name = null;
            symbol = null;
            uri = null;
            return false;
        }

        return true;
    }

    public static bool TryParseMetaplexMetadata(
        ReadOnlySpan<byte> payload,
        out string? mint,
        out string? name,
        out string? symbol,
        out string? uri)
    {
        mint = null;
        name = null;
        symbol = null;
        uri = null;

        // key (1) + update authority (32) + mint (32)
        if (payload.Length < 65)
        {
            return false;
        }

        mint = Base58Codec.Encode(payload.Slice(33, 32));
        var offset = 65;

        if (!TryReadBorshString(payload, ref offset, out name)
            || !TryReadBorshString(payload, ref offset, out symbol)
            || !TryReadBorshString(payload, ref offset, out uri))
        {
            mint = null;
            name = null;
            symbol = null;
            uri = null;
            return false;
        }

        return true;
    }

    private static bool TryReadBorshString(ReadOnlySpan<byte> payload, ref int offset, out string? value)
    {
        value = null;

        if (offset + 4 > payload.Length)
        {
            return false;
        }

        var length = BinaryPrimitives.ReadUInt32LittleEndian(payload.Slice(offset, 4));
        offset += 4;

        if (length > int.MaxValue)
        {
            return false;
        }

        var valueLength = (int)length;
        if (offset + valueLength > payload.Length)
        {
            return false;
        }

        var raw = payload.Slice(offset, valueLength);
        offset += valueLength;

        var decoded = Encoding.UTF8.GetString(raw).TrimEnd('\0').Trim();
        value = string.IsNullOrWhiteSpace(decoded) ? null : decoded;
        return true;
    }

    private static bool IsAllZeros(ReadOnlySpan<byte> bytes)
    {
        foreach (var value in bytes)
        {
            if (value != 0)
            {
                return false;
            }
        }

        return true;
    }
}
