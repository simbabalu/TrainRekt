using System.Numerics;
using System.Text;

namespace TrainRekt.Api.Domain.Utils;

public static class Base58Codec
{
    private const string Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    public static bool TryDecode(string value, out byte[] bytes)
    {
        bytes = Array.Empty<byte>();
        if (string.IsNullOrWhiteSpace(value)) return false;

        var trimmed = value.Trim();
        BigInteger integer = BigInteger.Zero;

        foreach (var character in trimmed)
        {
            var index = Alphabet.IndexOf(character);
            if (index < 0) return false;
            integer *= 58;
            integer += index;
        }

        var data = integer.ToByteArray(isUnsigned: true, isBigEndian: true);
        var leadingZeroCount = trimmed.TakeWhile(static character => character == '1').Count();
        bytes = new byte[leadingZeroCount + data.Length];
        if (data.Length > 0)
        {
            data.CopyTo(bytes, leadingZeroCount);
        }

        return true;
    }

    public static string Encode(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length == 0) return string.Empty;

        var leadingZeroCount = 0;
        foreach (var value in bytes)
        {
            if (value == 0)
            {
                leadingZeroCount += 1;
                continue;
            }
            break;
        }

        var integer = new BigInteger(bytes, isUnsigned: true, isBigEndian: true);
        var builder = new StringBuilder();

        while (integer > 0)
        {
            integer = BigInteger.DivRem(integer, 58, out var remainder);
            builder.Insert(0, Alphabet[(int)remainder]);
        }

        if (builder.Length == 0)
        {
            builder.Append('1');
        }

        for (var index = 0; index < leadingZeroCount; index += 1)
        {
            builder.Insert(0, '1');
        }

        return builder.ToString();
    }
}
