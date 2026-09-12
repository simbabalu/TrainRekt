using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Infrastructure.Solana;

public sealed record ParsedSkrGuardianPoolAccount(
    string StakeConfig,
    bool Active);

public static class SkrGuardianPoolParser
{
    private static readonly byte[] GuardianPoolDiscriminator =
    [
        133, 238, 255, 214, 215, 11, 189, 23
    ];

    private const int StakeConfigOffset = 8;
    private const int ActiveOffset = 8 + 32 + 32 + 32 + 16 + 16 + 16 + 16 + 2 + 1;
    private const int MinimumLength = ActiveOffset + 1;

    public static bool TryParse(ReadOnlySpan<byte> data, out ParsedSkrGuardianPoolAccount? parsed)
    {
        parsed = null;

        if (data.Length < MinimumLength
            || !data.Slice(0, GuardianPoolDiscriminator.Length).SequenceEqual(GuardianPoolDiscriminator))
        {
            return false;
        }

        var activeByte = data[ActiveOffset];
        if (activeByte is > 1)
        {
            return false;
        }

        parsed = new ParsedSkrGuardianPoolAccount(
            StakeConfig: Base58Codec.Encode(data.Slice(StakeConfigOffset, 32)),
            Active: activeByte == 1);

        return true;
    }
}
