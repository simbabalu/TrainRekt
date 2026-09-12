using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Infrastructure.Solana;

public sealed record ParsedSkrStakeConfigAccount(
    string Authority,
    string Mint,
    string StakeVault);

public static class SkrStakeConfigParser
{
    private static readonly byte[] StakeConfigDiscriminator =
    [
        238, 151, 43, 3, 11, 151, 63, 176
    ];

    private const int BumpOffset = 8;
    private const int AuthorityOffset = BumpOffset + 1;
    private const int MintOffset = AuthorityOffset + 32;
    private const int StakeVaultOffset = MintOffset + 32;
    private const int MinimumStakeConfigLength = StakeVaultOffset + 32;

    public static bool TryParse(ReadOnlySpan<byte> data, out ParsedSkrStakeConfigAccount? parsed)
    {
        parsed = null;

        if (data.Length < MinimumStakeConfigLength
            || !data.Slice(0, StakeConfigDiscriminator.Length).SequenceEqual(StakeConfigDiscriminator))
        {
            return false;
        }

        parsed = new ParsedSkrStakeConfigAccount(
            Authority: Base58Codec.Encode(data.Slice(AuthorityOffset, 32)),
            Mint: Base58Codec.Encode(data.Slice(MintOffset, 32)),
            StakeVault: Base58Codec.Encode(data.Slice(StakeVaultOffset, 32)));

        return true;
    }
}
