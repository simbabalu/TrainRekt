using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Tests;

public sealed class SkrStakingVaultClassifierTests
{
    private sealed class FakeHeliusClient : IHeliusClient
    {
        private readonly Dictionary<string, Queue<string>> _responsesByMethod = new(StringComparer.Ordinal);

        public int CallCount { get; private set; }

        public Dictionary<string, int> CallsByAddress { get; } = new(StringComparer.Ordinal);

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

            if (parameters.Count > 0 && parameters[0] is string address)
            {
                CallsByAddress[address] = CallsByAddress.TryGetValue(address, out var count) ? count + 1 : 1;
            }

            if (!_responsesByMethod.TryGetValue(method, out var queue) || queue.Count == 0)
            {
                throw new InvalidOperationException($"Missing fake response for method {method}");
            }

            return Task.FromResult(JsonDocument.Parse(queue.Dequeue()));
        }
    }

    private sealed class ReaderConsumer
    {
        private readonly ISolanaAccountReader _reader;

        public ReaderConsumer(ISolanaAccountReader reader)
        {
            _reader = reader;
        }

        public Task<SolanaAccountInfo?> ReadAsync(string address, CancellationToken cancellationToken)
        {
            return _reader.GetAccountInfoAsync(address, cancellationToken);
        }
    }

    [Fact]
    public async Task TryClassifyAsync_CanonicalStakeVault_ReturnsVerifiedStakingVault()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        fakeClient.Enqueue(
            "getAccountInfo",
            BuildAccountInfoResponse(
                ProtocolConstants.SolanaMobileSkrStakingProgramId,
                BuildStakeConfigData(
                    authority: KeyFromByte(9),
                    mint: ProtocolConstants.SolanaMobileSkrMint,
                    stakeVault: ProtocolConstants.SolanaMobileSkrStakeVaultAddress)));
        fakeClient.Enqueue(
            "getAccountInfo",
            BuildAccountInfoResponse(
                ProtocolConstants.SolanaMobileSkrStakingProgramId,
                BuildGuardianPoolData(stakeConfig: ProtocolConstants.SolanaMobileSkrStakeConfigAddress, active: true)));

        var context = CreateContext(
            requestMint: ProtocolConstants.SolanaMobileSkrMint,
            tokenAccountAddress: ProtocolConstants.SolanaMobileSkrStakeVaultAddress,
            tokenAccountMint: ProtocolConstants.SolanaMobileSkrMint,
            tokenAccountAuthority: ProtocolConstants.SolanaMobileSkrStakeConfigAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(TokenAccountClassificationConstants.StakingVault, result.Classification);
        Assert.Equal(ProtocolConstants.SolanaMobileSkrProtocolName, result.Protocol);
        Assert.Equal(TokenAccountClassificationConstants.Verified, result.Confidence);
        Assert.Contains(result.Evidence, entry => entry.Type == "verified_stake_vault" && entry.Value == ProtocolConstants.SolanaMobileSkrStakeVaultAddress);
    }

    [Fact]
    public async Task TryClassifyAsync_SameStakeVaultAddressButWrongMint_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        var context = CreateContext(
            requestMint: KeyFromByte(55),
            tokenAccountAddress: ProtocolConstants.SolanaMobileSkrStakeVaultAddress,
            tokenAccountMint: KeyFromByte(55),
            tokenAccountAuthority: ProtocolConstants.SolanaMobileSkrStakeConfigAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
        Assert.Equal(0, fakeClient.CallCount);
    }

    [Fact]
    public async Task TryClassifyAsync_CanonicalSkrMintArbitraryAccount_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        var context = CreateContext(
            requestMint: ProtocolConstants.SolanaMobileSkrMint,
            tokenAccountAddress: KeyFromByte(88),
            tokenAccountMint: ProtocolConstants.SolanaMobileSkrMint,
            tokenAccountAuthority: ProtocolConstants.SolanaMobileSkrStakeConfigAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
        Assert.Equal(0, fakeClient.CallCount);
    }

    [Fact]
    public async Task TryClassifyAsync_WrongStakingProgramOwner_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        fakeClient.Enqueue(
            "getAccountInfo",
            BuildAccountInfoResponse(
                SolanaTokenConstants.SplTokenProgramId,
                BuildStakeConfigData(
                    authority: KeyFromByte(9),
                    mint: ProtocolConstants.SolanaMobileSkrMint,
                    stakeVault: ProtocolConstants.SolanaMobileSkrStakeVaultAddress)));

        var result = await classifier.TryClassifyAsync(CreateCanonicalContext(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_InvalidStakeConfigPda_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        var context = CreateContext(
            requestMint: ProtocolConstants.SolanaMobileSkrMint,
            tokenAccountAddress: ProtocolConstants.SolanaMobileSkrStakeVaultAddress,
            tokenAccountMint: ProtocolConstants.SolanaMobileSkrMint,
            tokenAccountAuthority: KeyFromByte(77),
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId);

        var result = await classifier.TryClassifyAsync(context, CancellationToken.None);

        Assert.Null(result);
        Assert.Equal(0, fakeClient.CallCount);
    }

    [Fact]
    public async Task TryClassifyAsync_MalformedStakeConfig_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        var malformed = new byte[17];
        fakeClient.Enqueue("getAccountInfo", BuildAccountInfoResponse(ProtocolConstants.SolanaMobileSkrStakingProgramId, malformed));

        var result = await classifier.TryClassifyAsync(CreateCanonicalContext(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_WrongStakeVaultRelationInStakeConfig_ReturnsNull()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        fakeClient.Enqueue(
            "getAccountInfo",
            BuildAccountInfoResponse(
                ProtocolConstants.SolanaMobileSkrStakingProgramId,
                BuildStakeConfigData(
                    authority: KeyFromByte(9),
                    mint: ProtocolConstants.SolanaMobileSkrMint,
                    stakeVault: KeyFromByte(44))));

        var result = await classifier.TryClassifyAsync(CreateCanonicalContext(), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task TryClassifyAsync_CancellationPropagates()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAsync<OperationCanceledException>(async () => await classifier.TryClassifyAsync(CreateCanonicalContext(), cts.Token));
        Assert.Equal(0, fakeClient.CallCount);
    }

    [Fact]
    public async Task TryClassifyAsync_UsesSharedReaderAcrossConsumers()
    {
        var fakeClient = new FakeHeliusClient();
        var reader = new ScopedSolanaAccountReader(fakeClient);
        var classifier = new SkrStakingVaultClassifier(reader);
        var consumer = new ReaderConsumer(reader);

        fakeClient.Enqueue(
            "getAccountInfo",
            BuildAccountInfoResponse(
                ProtocolConstants.SolanaMobileSkrStakingProgramId,
                BuildStakeConfigData(
                    authority: KeyFromByte(9),
                    mint: ProtocolConstants.SolanaMobileSkrMint,
                    stakeVault: ProtocolConstants.SolanaMobileSkrStakeVaultAddress)));
        fakeClient.Enqueue(
            "getAccountInfo",
            BuildAccountInfoResponse(
                ProtocolConstants.SolanaMobileSkrStakingProgramId,
                BuildGuardianPoolData(stakeConfig: ProtocolConstants.SolanaMobileSkrStakeConfigAddress, active: true)));

        var accountInfo = await consumer.ReadAsync(ProtocolConstants.SolanaMobileSkrStakeConfigAddress, CancellationToken.None);
        var classification = await classifier.TryClassifyAsync(CreateCanonicalContext(), CancellationToken.None);

        Assert.NotNull(accountInfo);
        Assert.NotNull(classification);
        Assert.Equal(2, fakeClient.CallCount);
    }

    [Fact]
    public async Task TryClassifyAsync_DoesNotDuplicateStakeConfigLookupAcrossCalls()
    {
        var fakeClient = new FakeHeliusClient();
        var classifier = new SkrStakingVaultClassifier(new ScopedSolanaAccountReader(fakeClient));

        fakeClient.Enqueue(
            "getAccountInfo",
            BuildAccountInfoResponse(
                ProtocolConstants.SolanaMobileSkrStakingProgramId,
                BuildStakeConfigData(
                    authority: KeyFromByte(9),
                    mint: ProtocolConstants.SolanaMobileSkrMint,
                    stakeVault: ProtocolConstants.SolanaMobileSkrStakeVaultAddress)));
        fakeClient.Enqueue(
            "getAccountInfo",
            BuildAccountInfoResponse(
                ProtocolConstants.SolanaMobileSkrStakingProgramId,
                BuildGuardianPoolData(stakeConfig: ProtocolConstants.SolanaMobileSkrStakeConfigAddress, active: true)));

        var result1 = await classifier.TryClassifyAsync(CreateCanonicalContext(), CancellationToken.None);
        var result2 = await classifier.TryClassifyAsync(CreateCanonicalContext(), CancellationToken.None);

        Assert.NotNull(result1);
        Assert.NotNull(result2);
        Assert.Equal(2, fakeClient.CallCount);
        Assert.Equal(1, fakeClient.CallsByAddress[ProtocolConstants.SolanaMobileSkrStakeConfigAddress]);
        Assert.Equal(1, fakeClient.CallsByAddress[ProtocolConstants.SolanaMobileSkrGuardianPoolAddress]);
    }

    private static TokenAccountClassificationContext CreateCanonicalContext()
    {
        return CreateContext(
            requestMint: ProtocolConstants.SolanaMobileSkrMint,
            tokenAccountAddress: ProtocolConstants.SolanaMobileSkrStakeVaultAddress,
            tokenAccountMint: ProtocolConstants.SolanaMobileSkrMint,
            tokenAccountAuthority: ProtocolConstants.SolanaMobileSkrStakeConfigAddress,
            tokenAccountProgramId: SolanaTokenConstants.SplTokenProgramId);
    }

    private static TokenAccountClassificationContext CreateContext(
        string requestMint,
        string tokenAccountAddress,
        string? tokenAccountMint,
        string? tokenAccountAuthority,
        string? tokenAccountProgramId)
    {
        return new TokenAccountClassificationContext(
            Request: new TokenAccountClassificationRequestContext(
                Mint: requestMint,
                MintProgramId: SolanaTokenConstants.SplTokenProgramId,
                PumpFun: null),
            TokenAccountAddress: tokenAccountAddress,
            TokenAccountMint: tokenAccountMint,
            TokenAccountAuthority: tokenAccountAuthority,
            TokenAccountProgramId: tokenAccountProgramId,
            TokenAccountAmountRaw: 100,
            PercentageOfSupply: null);
    }

    private static byte[] BuildStakeConfigData(string authority, string mint, string stakeVault)
    {
        var data = new byte[160];

        var discriminator = new byte[] { 238, 151, 43, 3, 11, 151, 63, 176 };
        discriminator.CopyTo(data, 0);

        data[8] = 1;
        WritePubkey(data, 9, authority);
        WritePubkey(data, 41, mint);
        WritePubkey(data, 73, stakeVault);

        return data;
    }

    private static byte[] BuildGuardianPoolData(string stakeConfig, bool active)
    {
        var data = new byte[240];

        var discriminator = new byte[] { 133, 238, 255, 214, 215, 11, 189, 23 };
        discriminator.CopyTo(data, 0);

        WritePubkey(data, 8, stakeConfig);
        WritePubkey(data, 40, KeyFromByte(3));
        WritePubkey(data, 72, KeyFromByte(4));

        data[171] = active ? (byte)1 : (byte)0;

        return data;
    }

    private static string BuildAccountInfoResponse(string ownerProgramId, byte[] data)
    {
        return "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":{\"owner\":\""
            + ownerProgramId
            + "\",\"data\":[\""
            + Convert.ToBase64String(data)
            + "\",\"base64\"]}}}";
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
}
