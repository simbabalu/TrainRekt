using System.Buffers.Binary;
using System.Text;
using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Tests;

public sealed class TokenMetadataResolverTests
{
    private sealed class FakeHeliusClient : IHeliusClient
    {
        private readonly Dictionary<string, Queue<string>> _responsesByMethod = new(StringComparer.Ordinal);

        public void Enqueue(string method, string json)
        {
            if (!_responsesByMethod.TryGetValue(method, out var queue))
            {
                queue = new Queue<string>();
                _responsesByMethod[method] = queue;
            }

            queue.Enqueue(json);
        }

        public HttpRequestMessage CreateRpcPostRequest(string jsonRpcPayload)
        {
            return new HttpRequestMessage(HttpMethod.Post, "https://localhost")
            {
                Content = new StringContent(jsonRpcPayload)
            };
        }

        public Task<JsonDocument> SendRpcRequestAsync(string method, IReadOnlyList<object?> parameters, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (!_responsesByMethod.TryGetValue(method, out var queue) || queue.Count == 0)
            {
                throw new InvalidOperationException($"Missing fake response for method {method}");
            }

            return Task.FromResult(JsonDocument.Parse(queue.Dequeue()));
        }
    }

    [Fact]
    public async Task ResolveAsync_DasMetadataAvailable_ReturnsDasFields()
    {
        var fakeClient = new FakeHeliusClient();
        var resolver = new TokenMetadataResolver(fakeClient);
        const string mint = "So11111111111111111111111111111111111111112";

        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"interface\":\"FungibleToken\",\"content\":{\"metadata\":{\"name\":\"DAS Name\",\"symbol\":\"DAS\"},\"json_uri\":\"https://das.example/meta.json\"},\"token_info\":{\"token_standard\":\"Fungible\"}}}");

        var result = await resolver.ResolveAsync(
            mint,
            SolanaTokenConstants.SplTokenProgramId,
            new byte[SolanaTokenConstants.MintAccountBaseLengthBytes],
            CancellationToken.None);

        Assert.Equal("DAS Name", result.Name);
        Assert.Equal("DAS", result.Symbol);
        Assert.Equal("https://das.example/meta.json", result.MetadataUri);
        Assert.Equal(true, result.IsFungibleByAsset);
    }

    [Fact]
    public async Task ResolveAsync_Token2022InlineMetadataFallback_ReturnsInlineFields()
    {
        var fakeClient = new FakeHeliusClient();
        var resolver = new TokenMetadataResolver(fakeClient);
        const string mint = "So11111111111111111111111111111111111111112";

        var tokenMetadataPayload = BuildToken2022TokenMetadataPayload(
            mint,
            "Inline Name",
            "INL",
            "https://inline.example/meta.json");

        var mintData = BuildToken2022MintData([
            CreateTlvEntry(19, tokenMetadataPayload)
        ]);

        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{},\"json_uri\":null}}}");
        fakeClient.Enqueue("getProgramAccounts", "{\"jsonrpc\":\"2.0\",\"result\":[]}");

        var result = await resolver.ResolveAsync(
            mint,
            SolanaTokenConstants.Token2022ProgramId,
            mintData,
            CancellationToken.None);

        Assert.Equal("Inline Name", result.Name);
        Assert.Equal("INL", result.Symbol);
        Assert.Equal("https://inline.example/meta.json", result.MetadataUri);
    }

    private static byte[] BuildToken2022MintData(IEnumerable<byte[]> extensionEntries)
    {
        var baseMint = new byte[SolanaTokenConstants.MintAccountBaseLengthBytes].ToList();

        while (baseMint.Count < SolanaTokenConstants.Token2022MintAccountTypeOffset)
        {
            baseMint.Add(0);
        }

        baseMint.Add(SolanaTokenConstants.Token2022MintAccountType);
        foreach (var entry in extensionEntries)
        {
            baseMint.AddRange(entry);
        }

        baseMint.Add(0);
        baseMint.Add(0);

        return baseMint.ToArray();
    }

    private static byte[] CreateTlvEntry(ushort type, byte[] payload)
    {
        var entry = new byte[4 + payload.Length];
        BinaryPrimitives.WriteUInt16LittleEndian(entry.AsSpan(0, 2), type);
        BinaryPrimitives.WriteUInt16LittleEndian(entry.AsSpan(2, 2), (ushort)payload.Length);
        payload.CopyTo(entry, 4);
        return entry;
    }

    private static byte[] BuildToken2022TokenMetadataPayload(string mint, string name, string symbol, string uri)
    {
        if (!Base58Codec.TryDecode(mint, out var mintBytes) || mintBytes.Length != 32)
        {
            throw new InvalidOperationException("Mint must decode to 32 bytes.");
        }

        using var stream = new MemoryStream();
        stream.Write(new byte[32]);
        stream.Write(mintBytes);
        WriteBorshString(stream, name);
        WriteBorshString(stream, symbol);
        WriteBorshString(stream, uri);

        var emptyVectorLength = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(emptyVectorLength, 0);
        stream.Write(emptyVectorLength);

        return stream.ToArray();
    }

    private static void WriteBorshString(Stream stream, string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var lengthBytes = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(lengthBytes, (uint)bytes.Length);
        stream.Write(lengthBytes);
        stream.Write(bytes);
    }
}
