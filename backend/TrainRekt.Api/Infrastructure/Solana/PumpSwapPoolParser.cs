using System.Buffers.Binary;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Infrastructure.Solana;

public sealed record ParsedPumpSwapPoolAccount(
    ushort Index,
    string Creator,
    string BaseMint,
    string QuoteMint,
    string PoolBaseTokenAccount,
    string PoolQuoteTokenAccount);

public static class PumpSwapPoolParser
{
    private static readonly byte[] PoolAccountDiscriminator =
    [
        241, 154, 109, 4, 17, 177, 109, 188
    ];

    private const int PoolBumpOffset = 8;
    private const int IndexOffset = PoolBumpOffset + 1;
    private const int CreatorOffset = IndexOffset + 2;
    private const int BaseMintOffset = CreatorOffset + 32;
    private const int QuoteMintOffset = BaseMintOffset + 32;
    private const int LpMintOffset = QuoteMintOffset + 32;
    private const int PoolBaseTokenAccountOffset = LpMintOffset + 32;
    private const int PoolQuoteTokenAccountOffset = PoolBaseTokenAccountOffset + 32;
    private const int MinimumPoolStateLength = PoolQuoteTokenAccountOffset + 32;

    public static bool TryParse(ReadOnlySpan<byte> data, out ParsedPumpSwapPoolAccount? parsed)
    {
        parsed = null;

        if (data.Length < MinimumPoolStateLength
            || !data.Slice(0, PoolAccountDiscriminator.Length).SequenceEqual(PoolAccountDiscriminator))
        {
            return false;
        }

        var index = BinaryPrimitives.ReadUInt16LittleEndian(data.Slice(IndexOffset, 2));

        parsed = new ParsedPumpSwapPoolAccount(
            Index: index,
            Creator: Base58Codec.Encode(data.Slice(CreatorOffset, 32)),
            BaseMint: Base58Codec.Encode(data.Slice(BaseMintOffset, 32)),
            QuoteMint: Base58Codec.Encode(data.Slice(QuoteMintOffset, 32)),
            PoolBaseTokenAccount: Base58Codec.Encode(data.Slice(PoolBaseTokenAccountOffset, 32)),
            PoolQuoteTokenAccount: Base58Codec.Encode(data.Slice(PoolQuoteTokenAccountOffset, 32)));

        return true;
    }
}
