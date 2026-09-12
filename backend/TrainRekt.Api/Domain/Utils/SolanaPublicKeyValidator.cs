namespace TrainRekt.Api.Domain.Utils;

public static class SolanaPublicKeyValidator
{
    public static bool TryNormalize(string? input, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input)) return false;

        var trimmed = input.Trim();
        if (!Base58Codec.TryDecode(trimmed, out var rawBytes)) return false;
        if (rawBytes.Length != 32) return false;

        normalized = Base58Codec.Encode(rawBytes);
        return true;
    }
}
