using System.Buffers.Binary;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Tests;

public sealed class SolanaMintParserTests
{
    [Fact]
    public void TryParse_ParsesAuthoritiesSupplyAndDecimals()
    {
        var mintAuthorityRaw = Enumerable.Repeat((byte)1, 32).ToArray();
        var freezeAuthorityRaw = Enumerable.Repeat((byte)2, 32).ToArray();

        var data = new byte[SolanaTokenConstants.MintAccountBaseLengthBytes];
        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(0, 4), 1);
        mintAuthorityRaw.CopyTo(data, 4);
        BinaryPrimitives.WriteUInt64LittleEndian(data.AsSpan(36, 8), 123_456UL);
        data[44] = 6;
        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(46, 4), 1);
        freezeAuthorityRaw.CopyTo(data, 50);

        var parsedOk = SolanaMintParser.TryParse(SolanaTokenConstants.SplTokenProgramId, data, out var parsed);

        Assert.True(parsedOk);
        Assert.NotNull(parsed);
        Assert.Equal(123_456UL, parsed.Supply);
        Assert.Equal(6, parsed.Decimals);
        Assert.Equal(Base58Codec.Encode(mintAuthorityRaw), parsed.MintAuthority);
        Assert.Equal(Base58Codec.Encode(freezeAuthorityRaw), parsed.FreezeAuthority);
        Assert.False(parsed.MintAuthorityRevoked);
        Assert.False(parsed.FreezeAuthorityRevoked);
    }

    [Fact]
    public void TryParse_DetectsRevokedAuthorities()
    {
        var data = new byte[SolanaTokenConstants.MintAccountBaseLengthBytes];
        BinaryPrimitives.WriteUInt64LittleEndian(data.AsSpan(36, 8), 10UL);
        data[44] = 2;

        var parsedOk = SolanaMintParser.TryParse(SolanaTokenConstants.SplTokenProgramId, data, out var parsed);

        Assert.True(parsedOk);
        Assert.NotNull(parsed);
        Assert.True(parsed.MintAuthorityRevoked);
        Assert.True(parsed.FreezeAuthorityRevoked);
        Assert.Null(parsed.MintAuthority);
        Assert.Null(parsed.FreezeAuthority);
    }

    [Fact]
    public void TryParse_Token2022Extensions_UsesCanonicalOffsetsAndSkipsPadding()
    {
        var extensionEntries = new[]
        {
            CreateTlvEntry(18, new byte[64]),
            CreateTlvEntry(19, new byte[3]),
            CreateTlvEntry(18, new byte[64])
        };

        var data = BuildToken2022MintData(extensionEntries, appendUninitializedTerminator: true);

        var parsedOk = SolanaMintParser.TryParse(SolanaTokenConstants.Token2022ProgramId, data, out var parsed);

        Assert.True(parsedOk);
        Assert.NotNull(parsed);
        Assert.Equal(new[] { "metadata-pointer", "token-metadata" }, parsed.Token2022Extensions);
        Assert.DoesNotContain("extension-0", parsed.Token2022Extensions);
    }

    [Fact]
    public void TryParse_Token2022Extensions_UnknownTypePreservedAndMalformedTailIgnored()
    {
        var validUnknown = CreateTlvEntry(999, new byte[] { 1, 2, 3 });

        var data = BuildToken2022MintData(new[] { validUnknown }, appendUninitializedTerminator: false);
        var truncated = new byte[] { 14, 0, 5, 0, 1, 2 };
        data = data.Concat(truncated).ToArray();

        var parsedOk = SolanaMintParser.TryParse(SolanaTokenConstants.Token2022ProgramId, data, out var parsed);

        Assert.True(parsedOk);
        Assert.NotNull(parsed);
        Assert.Equal(new[] { "extension-999" }, parsed.Token2022Extensions);
    }

    private static byte[] BuildToken2022MintData(IEnumerable<byte[]> extensionEntries, bool appendUninitializedTerminator)
    {
        var data = new byte[SolanaTokenConstants.MintAccountBaseLengthBytes];
        BinaryPrimitives.WriteUInt64LittleEndian(data.AsSpan(36, 8), 1_000UL);
        data[44] = 6;
        data[45] = 1;

        var buffer = data.ToList();
        while (buffer.Count < SolanaTokenConstants.Token2022MintAccountTypeOffset)
        {
            buffer.Add(0);
        }

        buffer.Add(SolanaTokenConstants.Token2022MintAccountType);

        foreach (var entry in extensionEntries)
        {
            buffer.AddRange(entry);
        }

        if (appendUninitializedTerminator)
        {
            buffer.Add(0);
            buffer.Add(0);
        }

        return buffer.ToArray();
    }

    private static byte[] CreateTlvEntry(ushort extensionType, byte[] value)
    {
        var bytes = new byte[4 + value.Length];
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(0, 2), extensionType);
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(2, 2), (ushort)value.Length);
        value.CopyTo(bytes, 4);
        return bytes;
    }
}
