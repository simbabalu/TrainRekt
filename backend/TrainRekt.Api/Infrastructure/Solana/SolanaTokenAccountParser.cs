using System.Buffers.Binary;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Infrastructure.Solana;

public sealed record ParsedTokenAccount(
    string Mint,
    string Authority,
    ulong AmountRaw);

public static class SolanaTokenAccountParser
{
    private const int MintOffset = 0;
    private const int AuthorityOffset = 32;
    private const int AmountOffset = 64;
    private const int MinimumTokenAccountLength = 72;

    public static bool TryParse(string programId, ReadOnlySpan<byte> accountData, out ParsedTokenAccount? parsed)
    {
        parsed = null;

        if (programId != SolanaTokenConstants.SplTokenProgramId && programId != SolanaTokenConstants.Token2022ProgramId)
        {
            return false;
        }

        if (accountData.Length < MinimumTokenAccountLength)
        {
            return false;
        }

        var mint = Base58Codec.Encode(accountData.Slice(MintOffset, 32));
        var authority = Base58Codec.Encode(accountData.Slice(AuthorityOffset, 32));
        var amount = BinaryPrimitives.ReadUInt64LittleEndian(accountData.Slice(AmountOffset, 8));

        parsed = new ParsedTokenAccount(mint, authority, amount);
        return true;
    }
}
