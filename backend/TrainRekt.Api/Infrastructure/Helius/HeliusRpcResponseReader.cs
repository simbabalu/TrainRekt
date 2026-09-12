using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;

namespace TrainRekt.Api.Infrastructure.Helius;

internal static class HeliusRpcResponseReader
{
    public static bool TryGetMintAccountInfo(
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

        if (!TryReadAccountDataBytes(root, out data))
        {
            return false;
        }

        return true;
    }

    public static bool TryGetLargestAccounts(JsonElement root, out IReadOnlyList<LargestTokenAccountEntry> balances)
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

    public static bool TryReadGenericAccountInfo(JsonElement root, out string ownerProgramId, out byte[] data)
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

    public static bool TryReadAccountDataBytes(JsonElement root, out byte[] data)
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

    public static bool TryReadProgramAccountDataBytes(JsonElement programAccountEntry, out byte[] data)
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

    public static string? TryGetNestedString(JsonElement root, params string[] path)
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
