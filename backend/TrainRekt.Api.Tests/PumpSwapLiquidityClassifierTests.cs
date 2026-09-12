using System.Buffers.Binary;
using System.Text.Json;
using Solnet.Wallet;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Tests;

public sealed class PumpSwapLiquidityClassifierTests
{
    private sealed class FakeHeliusClient : IHeliusClient
    {
        private readonly Dictionary<string, Queue<string>> _responsesByMethod = new(StringComparer.Ordinal);

        public int CallCount { get; private set; }

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
            CallCount += 1;

            if (!_responsesByMethod.TryGetValue(method, out var queue) || queue.Count == 0)
            {
                throw new InvalidOperationException($"Missing fake response for method {method}");
            }

            return Task.FromResult(JsonDocument.Parse(queue.Dequeue()));
        }
    }

    [Fact]
    public async Task TryClassifyAsync_CanonicalPumpSwapBaseVault_ReturnsVerifiedLiquidityPool()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 0);

        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.PumpSwapProgramId, fixture.PoolData));

        var context = CreateContext(
            requestMint: fixture.BaseMint,
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: fixture.PoolBaseTokenAccount,
            tokenAccountMint: fixture.BaseMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 600_000UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(TokenAccountClassificationConstants.LiquidityPool, result.Classification);
        Assert.Equal(ProtocolConstants.PumpSwapProtocolName, result.Protocol);
        Assert.Equal(TokenAccountClassificationConstants.Verified, result.Confidence);
        Assert.Contains(result.Evidence, entry => entry.Type == "verified_program_id" && entry.Value == ProtocolConstants.PumpSwapProgramId);
        Assert.Contains(result.Evidence, entry => entry.Type == "verified_pool_account" && entry.Value == fixture.PoolAddress);
    }

    [Fact]
    public async Task TryClassifyAsync_WrongPoolProgramOwner_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 1);

        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(SolanaTokenConstants.SplTokenProgramId, fixture.PoolData));

        var context = CreateContext(
            requestMint: fixture.BaseMint,
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: fixture.PoolBaseTokenAccount,
            tokenAccountMint: fixture.BaseMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 100UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_WrongPoolVaultAddress_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 2);

        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.PumpSwapProgramId, fixture.PoolData));

        var context = CreateContext(
            requestMint: fixture.BaseMint,
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: KeyFromByte(79),
            tokenAccountMint: fixture.BaseMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 100UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_CorrectPoolButDifferentInspectedMint_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 3);

        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.PumpSwapProgramId, fixture.PoolData));

        var context = CreateContext(
            requestMint: KeyFromByte(88),
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: fixture.PoolBaseTokenAccount,
            tokenAccountMint: KeyFromByte(88),
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 100UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_TokenAccountMintMismatch_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 4);

        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.PumpSwapProgramId, fixture.PoolData));

        var context = CreateContext(
            requestMint: fixture.BaseMint,
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: fixture.PoolBaseTokenAccount,
            tokenAccountMint: fixture.QuoteMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 100UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_MalformedPoolState_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 5);

        var malformed = fixture.PoolData.Take(40).ToArray();
        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.PumpSwapProgramId, malformed));

        var context = CreateContext(
            requestMint: fixture.BaseMint,
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: fixture.PoolBaseTokenAccount,
            tokenAccountMint: fixture.BaseMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 100UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_InvalidPoolDiscriminator_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 6);

        var invalid = fixture.PoolData.ToArray();
        invalid[0] ^= 0xFF;
        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.PumpSwapProgramId, invalid));

        var context = CreateContext(
            requestMint: fixture.BaseMint,
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: fixture.PoolBaseTokenAccount,
            tokenAccountMint: fixture.BaseMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 100UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_CancellationPropagates()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 7);

        using var cts = new CancellationTokenSource();
        cts.Cancel();

        var context = CreateContext(
            requestMint: fixture.BaseMint,
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: fixture.PoolBaseTokenAccount,
            tokenAccountMint: fixture.BaseMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 100UL);

        await Assert.ThrowsAsync<OperationCanceledException>(async () => await classifier.TryClassifyAsync(context, cts.Token));
        Assert.Equal(0, fakeClient.CallCount);
    }

    [Fact]
    public async Task TryClassifyAsync_MintEndingPumpWithoutDeterministicPoolEvidence_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));

        var context = CreateContext(
            requestMint: "7LSsEoJGhLeZzGvDofTdNg7M3JttxQqGWNLo6vWMpump",
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: KeyFromByte(101),
            tokenAccountMint: "7LSsEoJGhLeZzGvDofTdNg7M3JttxQqGWNLo6vWMpump",
            tokenAccountAuthority: string.Empty,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 999_999UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
        Assert.Equal(0, fakeClient.CallCount);
    }

    [Fact]
    public async Task TryClassifyAsync_ArbitraryLargeTokenAccount_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));

        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(SolanaTokenConstants.SplTokenProgramId, Enumerable.Repeat((byte)11, 200).ToArray()));

        var context = CreateContext(
            requestMint: KeyFromByte(41),
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: KeyFromByte(42),
            tokenAccountMint: KeyFromByte(41),
            tokenAccountAuthority: KeyFromByte(43),
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 12_345_678UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_Token2022VaultPath_ReturnsVerifiedLiquidityPool()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 8);

        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.PumpSwapProgramId, fixture.PoolData));

        var context = CreateContext(
            requestMint: fixture.QuoteMint,
            requestMintProgramId: SolanaTokenConstants.Token2022ProgramId,
            tokenAccountAddress: fixture.PoolQuoteTokenAccount,
            tokenAccountMint: fixture.QuoteMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.Token2022ProgramId,
            tokenAccountAmountRaw: 50_000UL);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(TokenAccountClassificationConstants.LiquidityPool, result.Classification);
        Assert.Equal(ProtocolConstants.PumpSwapProtocolName, result.Protocol);
        Assert.Equal(TokenAccountClassificationConstants.Verified, result.Confidence);
    }

    [Fact]
    public async Task TryClassifyAsync_ReusesPoolLookupPerRequestScope()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new PumpSwapLiquidityClassifier(new ScopedSolanaAccountReader(fakeClient));
        var fixture = CreateFixture(index: 9);

        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.PumpSwapProgramId, fixture.PoolData));

        var first = CreateContext(
            requestMint: fixture.BaseMint,
            requestMintProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAddress: fixture.PoolBaseTokenAccount,
            tokenAccountMint: fixture.BaseMint,
            tokenAccountAuthority: fixture.PoolAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId,
            tokenAccountAmountRaw: 1UL);

        var second = first with { TokenAccountAddress = KeyFromByte(111) };

        var result1 = await classifier.TryClassifyAsync(first, CancellationToken.None);
        var result2 = await classifier.TryClassifyAsync(second, CancellationToken.None);

        Assert.NotNull(result1);
        Assert.Null(result2);
        Assert.Equal(1, fakeClient.CallCount);
    }

    private static TokenAccountClassificationContext CreateContext(
        string requestMint,
        string requestMintProgramId,
        string tokenAccountAddress,
        string? tokenAccountMint,
        string? tokenAccountAuthority,
        string? tokenAccountProgramId,
        ulong tokenAccountAmountRaw)
    {
        return new TokenAccountClassificationContext(
            Request: new TokenAccountClassificationRequestContext(
                Mint: requestMint,
                MintProgramId: requestMintProgramId,
                PumpFun: null),
            TokenAccountAddress: tokenAccountAddress,
            TokenAccountMint: tokenAccountMint,
            TokenAccountAuthority: tokenAccountAuthority,
            TokenAccountProgramId: tokenAccountProgramId,
            TokenAccountAmountRaw: tokenAccountAmountRaw,
            PercentageOfSupply: null);
    }

    private static string BuildAccountInfoResponse(string ownerProgramId, byte[] data)
    {
        return "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":{\"owner\":\""
            + ownerProgramId
            + "\",\"data\":[\""
            + Convert.ToBase64String(data)
            + "\",\"base64\"]}}}";
    }

    private static PumpSwapFixture CreateFixture(ushort index)
    {
        var creator = KeyFromByte(21);
        var baseMint = KeyFromByte(31);
        var quoteMint = KeyFromByte(41);
        var lpMint = KeyFromByte(51);
        var poolBaseTokenAccount = KeyFromByte(61);
        var poolQuoteTokenAccount = KeyFromByte(71);

        var creatorKey = new PublicKey(creator);
        var baseMintKey = new PublicKey(baseMint);
        var quoteMintKey = new PublicKey(quoteMint);

        var indexSeed = new byte[2];
        BinaryPrimitives.WriteUInt16LittleEndian(indexSeed, index);

        Assert.True(PublicKey.TryFindProgramAddress(
            new[]
            {
                System.Text.Encoding.UTF8.GetBytes(ProtocolConstants.PumpSwapPoolSeed),
                indexSeed,
                creatorKey.KeyBytes,
                baseMintKey.KeyBytes,
                quoteMintKey.KeyBytes
            },
            new PublicKey(ProtocolConstants.PumpSwapProgramId),
            out var poolAddress,
            out _));

        var poolData = BuildPoolStateData(
            index,
            creator,
            baseMint,
            quoteMint,
            lpMint,
            poolBaseTokenAccount,
            poolQuoteTokenAccount);

        return new PumpSwapFixture(
            PoolAddress: poolAddress.Key,
            BaseMint: baseMint,
            QuoteMint: quoteMint,
            PoolBaseTokenAccount: poolBaseTokenAccount,
            PoolQuoteTokenAccount: poolQuoteTokenAccount,
            PoolData: poolData);
    }

    private static byte[] BuildPoolStateData(
        ushort index,
        string creator,
        string baseMint,
        string quoteMint,
        string lpMint,
        string poolBaseTokenAccount,
        string poolQuoteTokenAccount)
    {
        var data = new byte[260];

        var discriminator = new byte[] { 241, 154, 109, 4, 17, 177, 109, 188 };
        discriminator.CopyTo(data, 0);

        data[8] = 200;
        BinaryPrimitives.WriteUInt16LittleEndian(data.AsSpan(9, 2), index);

        WritePubkey(data, 11, creator);
        WritePubkey(data, 43, baseMint);
        WritePubkey(data, 75, quoteMint);
        WritePubkey(data, 107, lpMint);
        WritePubkey(data, 139, poolBaseTokenAccount);
        WritePubkey(data, 171, poolQuoteTokenAccount);

        return data;
    }

    private static void WritePubkey(byte[] destination, int offset, string pubkey)
    {
        Assert.True(Base58Codec.TryDecode(pubkey, out var bytes));
        Assert.Equal(32, bytes.Length);
        bytes.CopyTo(destination, offset);
    }

    private static string KeyFromByte(byte value)
    {
        return Base58Codec.Encode(Enumerable.Repeat(value, 32).ToArray());
    }

    private sealed record PumpSwapFixture(
        string PoolAddress,
        string BaseMint,
        string QuoteMint,
        string PoolBaseTokenAccount,
        string PoolQuoteTokenAccount,
        byte[] PoolData);
}
