using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Solnet.Programs;
using Solnet.Wallet;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Tests;

public sealed class TokenInspectionServiceTests
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
    public async Task InspectAsync_InvalidMint_ReturnsInvalidMintErrorWithoutProviderCall()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);

        var result = await service.InspectAsync("invalid", CancellationToken.None);

        Assert.NotNull(result.Error);
        Assert.Equal(TokenInspectionErrorCode.InvalidMint, result.Error.Code);
        Assert.Equal(0, fakeClient.CallCount);
    }

    [Fact]
    public async Task InspectAsync_ParsesTokenAndAuthorities()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);
        var mint = "So11111111111111111111111111111111111111112";

        var mintData = BuildMintData(
            supply: 1_000_000,
            decimals: 6,
            mintAuthorityOption: 1,
            freezeAuthorityOption: 1);

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"600000\"},{\"amount\":\"200000\"},{\"amount\":\"100000\"}]}}");
        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{\"name\":\"Test Token\",\"symbol\":\"TEST\"},\"json_uri\":\"https://example.com/token.json\"}}}");

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.Null(result.Error);
        Assert.NotNull(result.Inspection);
        Assert.Equal(6, result.Inspection.Identity.Decimals);
        Assert.Equal("1000000", result.Inspection.Identity.SupplyRaw);
        Assert.False(result.Inspection.Authorities.MintAuthorityRevoked);
        Assert.False(result.Inspection.Authorities.FreezeAuthorityRevoked);
        Assert.Equal(60m, result.Inspection.HolderConcentration.TopHolderPercentage);
        Assert.Equal("Test Token", result.Inspection.Identity.Name);
        Assert.Equal("TEST", result.Inspection.Identity.Symbol);
    }

    [Fact]
    public async Task InspectAsync_MalformedLargestAccountsPayload_ReturnsProviderMalformedResponse()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);
        var mint = "So11111111111111111111111111111111111111112";

        var mintData = BuildMintData(
            supply: 100,
            decimals: 2,
            mintAuthorityOption: 0,
            freezeAuthorityOption: 0);

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"not-a-number\"}]}}");

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Error);
        Assert.Equal(TokenInspectionErrorCode.ProviderMalformedResponse, result.Error.Code);
    }

    [Fact]
    public async Task InspectAsync_DasMetadataAvailable_UsesDasValues()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);
        var mint = "So11111111111111111111111111111111111111112";

        var mintData = BuildMintData(
            supply: 500_000,
            decimals: 6,
            mintAuthorityOption: 0,
            freezeAuthorityOption: 0);

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"250000\"}]}}");
        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{\"name\":\"DAS Name\",\"symbol\":\"DAS\"},\"json_uri\":\"https://das.example/meta.json\"}}}");

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Equal("DAS Name", result.Inspection.Identity.Name);
        Assert.Equal("DAS", result.Inspection.Identity.Symbol);
        Assert.Equal("https://das.example/meta.json", result.Inspection.Identity.MetadataUri);
    }

    [Fact]
    public async Task InspectAsync_DasMetadataMissing_UsesToken2022InlineTokenMetadataExtension()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);
        var mint = "So11111111111111111111111111111111111111112";

        var tokenMetadataPayload = BuildToken2022TokenMetadataPayload(
            mint,
            "Inline Name",
            "INL",
            "https://inline.example/meta.json");

        var mintData = BuildToken2022MintData(
            extensionEntries:
            [
                CreateTlvEntry(19, tokenMetadataPayload)
            ],
            appendUninitializedTerminator: true);

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.Token2022ProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"250000\"}]}}");
        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{},\"json_uri\":null}}}");

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Equal("Inline Name", result.Inspection.Identity.Name);
        Assert.Equal("INL", result.Inspection.Identity.Symbol);
        Assert.Equal("https://inline.example/meta.json", result.Inspection.Identity.MetadataUri);
    }

    [Fact]
    public async Task InspectAsync_DasMissing_UsesMetaplexMetadataFallback()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);
        var mint = "So11111111111111111111111111111111111111112";

        var mintData = BuildMintData(
            supply: 1_000_000,
            decimals: 9,
            mintAuthorityOption: 0,
            freezeAuthorityOption: 0);

        var metaplexPayload = BuildMetaplexMetadataPayload(
            mint,
            "Metaplex Name",
            "MPLX",
            "https://mplx.example/meta.json");

        var metaplexResult =
            "{\"jsonrpc\":\"2.0\",\"result\":[{" +
            "\"account\":{\"data\":[\"" + Convert.ToBase64String(metaplexPayload) + "\",\"base64\"]}" +
            "}]}";

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"500000\"}]}}");
        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{},\"json_uri\":null}}}");
        fakeClient.Enqueue("getProgramAccounts", metaplexResult);

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Equal("Metaplex Name", result.Inspection.Identity.Name);
        Assert.Equal("MPLX", result.Inspection.Identity.Symbol);
        Assert.Equal("https://mplx.example/meta.json", result.Inspection.Identity.MetadataUri);
    }

    [Fact]
    public async Task InspectAsync_MetadataGenuinelyUnavailable_ReturnsNullMetadata()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);
        var mint = "So11111111111111111111111111111111111111112";

        var mintData = BuildMintData(
            supply: 1_000,
            decimals: 9,
            mintAuthorityOption: 0,
            freezeAuthorityOption: 0);

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"500\"}]}}");
        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{},\"json_uri\":null}}}");
        fakeClient.Enqueue("getProgramAccounts", "{\"jsonrpc\":\"2.0\",\"result\":[]}");

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.Null(result.Inspection.Identity.Name);
        Assert.Null(result.Inspection.Identity.Symbol);
        Assert.Null(result.Inspection.Identity.MetadataUri);
    }

    [Fact]
    public async Task InspectAsync_PumpFunBondingCurveLargestAccount_IsClassifiedDeterministically()
    {
        var fakeClient = new FakeHeliusClient();
        var classificationService = new TokenAccountClassificationService(new ITokenAccountClassifier[]
        {
            new PumpFunBondingCurveClassifier()
        });
        var service = new TokenInspectionService(
            fakeClient,
            new TokenMetadataResolver(fakeClient),
            new LargestTokenAccountAnalysisService(fakeClient, new ScopedSolanaAccountReader(fakeClient), classificationService));
        var mint = "So11111111111111111111111111111111111111112";

        var mintData = BuildMintData(
            supply: 1_000_000,
            decimals: 6,
            mintAuthorityOption: 0,
            freezeAuthorityOption: 0);

        var mintKey = new PublicKey(mint);
        var pumpProgram = new PublicKey(ProtocolConstants.PumpFunProgramId);
        Assert.True(PublicKey.TryFindProgramAddress(
            new[] { Encoding.UTF8.GetBytes(ProtocolConstants.PumpFunBondingCurveSeed), mintKey.KeyBytes },
            pumpProgram,
            out var bondingCurvePda,
            out _));

        var tokenProgram = new PublicKey(SolanaTokenConstants.SplTokenProgramId);
        Assert.True(PublicKey.TryFindProgramAddress(
            new[] { bondingCurvePda.KeyBytes, tokenProgram.KeyBytes, mintKey.KeyBytes },
            AssociatedTokenAccountProgram.ProgramIdKey,
            out var bondingCurveTokenAccount,
            out _));

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{ProtocolConstants.PumpFunProgramId}\",\"data\":[\"{Convert.ToBase64String(BuildPumpFunBondingCurveAccountData(complete: true))}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(BuildTokenAccountData(mint, bondingCurvePda.Key, 600_000))}\",\"base64\"]}}}}}}");

        fakeClient.Enqueue("getTokenLargestAccounts", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":[{{\"address\":\"{bondingCurveTokenAccount.Key}\",\"amount\":\"600000\"}}]}}}}");
        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{},\"json_uri\":null}}}");
        fakeClient.Enqueue("getProgramAccounts", "{\"jsonrpc\":\"2.0\",\"result\":[]}");

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        var largest = Assert.Single(result.Inspection.LargestTokenAccounts);
        Assert.Equal(TokenAccountClassificationConstants.BondingCurve, largest.Classification.Classification);
        Assert.Equal(ProtocolConstants.PumpFunProtocolName, largest.Classification.Protocol);
        Assert.Equal(TokenAccountClassificationConstants.Verified, largest.Classification.Confidence);

        Assert.NotNull(result.Inspection.PumpFunContext);
        Assert.True(result.Inspection.PumpFunContext.BondingCurveDetected);
        Assert.Equal(true, result.Inspection.PumpFunContext.Complete);

        Assert.NotNull(result.Inspection.HolderConcentration.UnclassifiedTokenAccountConcentration);
        Assert.Equal(60m, result.Inspection.HolderConcentration.UnclassifiedTokenAccountConcentration.ClassifiedProtocolPercentage);
        Assert.Equal(0m, result.Inspection.HolderConcentration.UnclassifiedTokenAccountConcentration.UnknownPercentageWithinReportedLargestAccounts);
    }

    [Fact]
    public async Task InspectAsync_CanonicalSkrMintWithActiveMintAuthority_PreservesRawAuthorityFactAndAddsDocumentedIssuanceContext()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);
        var mint = ProtocolConstants.SolanaMobileSkrMint;

        var mintData = BuildMintData(
            supply: 10_000_000_000,
            decimals: 6,
            mintAuthorityOption: 1,
            freezeAuthorityOption: 0);

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getAccountInfo", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":null}}");
        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"1000000\"}]}}");
        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{\"name\":\"SKR\",\"symbol\":\"SKR\"},\"json_uri\":null}}}");

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.False(result.Inspection.Authorities.MintAuthorityRevoked);
        Assert.NotNull(result.Inspection.Authorities.MintAuthority);

        Assert.NotNull(result.Inspection.ProtocolContext);
        Assert.Equal(ProtocolConstants.SolanaMobileSkrProtocolName, result.Inspection.ProtocolContext.Protocol);
        Assert.Contains(result.Inspection.ProtocolContext.Claims, claim =>
            claim.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE"
            && claim.VerificationStatus == ResearchClaimVerificationStatus.Documented
            && claim.Consistency == ObservedConsistency.Consistent);
        Assert.Contains(result.Inspection.ProtocolContext.Claims, claim =>
            claim.Id == "MINT_AUTHORITY_IDENTITY_MATCHES_DOCUMENTED_ISSUANCE_CONTROL"
            && claim.VerificationStatus == ResearchClaimVerificationStatus.NotVerified);

        Assert.Null(result.Inspection.PumpFunContext);

        Assert.Contains(result.Inspection.ReviewSignals, signal => signal.Id == "ACTIVE_MINT_AUTHORITY");
        Assert.Contains(result.Inspection.ReviewSignals, signal => signal.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE");
    }

    [Fact]
    public async Task InspectAsync_CanonicalSkrMintWithRevokedMintAuthority_EmitsDocumentedIssuanceMismatchSignal()
    {
        var fakeClient = new FakeHeliusClient();
        var service = new TokenInspectionService(fakeClient);
        var mint = ProtocolConstants.SolanaMobileSkrMint;

        var mintData = BuildMintData(
            supply: 10_000_000_000,
            decimals: 6,
            mintAuthorityOption: 0,
            freezeAuthorityOption: 0);

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");
        fakeClient.Enqueue("getAccountInfo", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":null}}");
        fakeClient.Enqueue("getTokenLargestAccounts", "{\"jsonrpc\":\"2.0\",\"result\":{\"value\":[{\"amount\":\"1000000\"}]}}");
        fakeClient.Enqueue("getAsset", "{\"jsonrpc\":\"2.0\",\"result\":{\"content\":{\"metadata\":{\"name\":\"SKR\",\"symbol\":\"SKR\"},\"json_uri\":null}}}");

        var result = await service.InspectAsync(mint, CancellationToken.None);

        Assert.NotNull(result.Inspection);
        Assert.True(result.Inspection.Authorities.MintAuthorityRevoked);
        Assert.NotNull(result.Inspection.ProtocolContext);
        Assert.Contains(result.Inspection.ProtocolContext.Claims, claim =>
            claim.Id == "DOCUMENTED_INFLATIONARY_ISSUANCE"
            && claim.VerificationStatus == ResearchClaimVerificationStatus.Documented
            && claim.Consistency == ObservedConsistency.Conflict);
        Assert.Contains(result.Inspection.ReviewSignals, signal => signal.Id == "MINT_AUTHORITY_STATE_MISMATCH_WITH_DOCUMENTED_ISSUANCE");
    }

    [Fact]
    public async Task InspectAsync_ExecutesLargestAccountAndMetadataStagesConcurrently()
    {
        var fakeClient = new FakeHeliusClient();
        var mint = "So11111111111111111111111111111111111111112";

        var mintData = BuildMintData(
            supply: 1_000_000,
            decimals: 6,
            mintAuthorityOption: 0,
            freezeAuthorityOption: 0);

        fakeClient.Enqueue("getAccountInfo", $"{{\"jsonrpc\":\"2.0\",\"result\":{{\"value\":{{\"owner\":\"{SolanaTokenConstants.SplTokenProgramId}\",\"data\":[\"{Convert.ToBase64String(mintData)}\",\"base64\"]}}}}}}");

        var largestStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var metadataStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        var largest = new CoordinatedLargestTokenAccountAnalysisService(largestStarted, release);
        var metadata = new CoordinatedTokenMetadataResolver(metadataStarted, release);

        var service = new TokenInspectionService(fakeClient, metadata, largest);

        var inspectTask = service.InspectAsync(mint, CancellationToken.None);

        await Task.WhenAll(largestStarted.Task, metadataStarted.Task);
        Assert.False(inspectTask.IsCompleted);

        release.SetResult(true);

        var result = await inspectTask;
        Assert.Null(result.Error);
        Assert.NotNull(result.Inspection);
    }

    private static byte[] BuildMintData(ulong supply, byte decimals, uint mintAuthorityOption, uint freezeAuthorityOption)
    {
        var data = new byte[SolanaTokenConstants.MintAccountBaseLengthBytes];
        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(0, 4), mintAuthorityOption);
        if (mintAuthorityOption != 0)
        {
            Enumerable.Repeat((byte)3, 32).ToArray().CopyTo(data, 4);
        }

        BinaryPrimitives.WriteUInt64LittleEndian(data.AsSpan(36, 8), supply);
        data[44] = decimals;
        data[45] = 1;
        BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(46, 4), freezeAuthorityOption);
        if (freezeAuthorityOption != 0)
        {
            Enumerable.Repeat((byte)7, 32).ToArray().CopyTo(data, 50);
        }

        return data;
    }

    private static byte[] BuildToken2022MintData(IEnumerable<byte[]> extensionEntries, bool appendUninitializedTerminator)
    {
        var baseMint = BuildMintData(
            supply: 1_000_000,
            decimals: 6,
            mintAuthorityOption: 0,
            freezeAuthorityOption: 0).ToList();

        while (baseMint.Count < SolanaTokenConstants.Token2022MintAccountTypeOffset)
        {
            baseMint.Add(0);
        }

        baseMint.Add(SolanaTokenConstants.Token2022MintAccountType);
        foreach (var entry in extensionEntries)
        {
            baseMint.AddRange(entry);
        }

        if (appendUninitializedTerminator)
        {
            baseMint.Add(0);
            baseMint.Add(0);
        }

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

        // update authority: None encoded as 32 zero bytes in OptionalNonZeroPubkey.
        stream.Write(new byte[32]);
        stream.Write(mintBytes);
        WriteBorshString(stream, name);
        WriteBorshString(stream, symbol);
        WriteBorshString(stream, uri);
        // additional_metadata: empty vec length.
        var emptyVectorLength = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(emptyVectorLength, 0);
        stream.Write(emptyVectorLength);

        return stream.ToArray();
    }

    private static byte[] BuildMetaplexMetadataPayload(string mint, string name, string symbol, string uri)
    {
        if (!Base58Codec.TryDecode(mint, out var mintBytes) || mintBytes.Length != 32)
        {
            throw new InvalidOperationException("Mint must decode to 32 bytes.");
        }

        using var stream = new MemoryStream();

        stream.WriteByte(4);
        stream.Write(new byte[32]);
        stream.Write(mintBytes);
        WriteBorshString(stream, name);
        WriteBorshString(stream, symbol);
        WriteBorshString(stream, uri);

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

    private static byte[] BuildTokenAccountData(string mint, string authority, ulong amount)
    {
        if (!Base58Codec.TryDecode(mint, out var mintBytes) || mintBytes.Length != 32)
        {
            throw new InvalidOperationException("Mint must decode to 32 bytes.");
        }

        if (!Base58Codec.TryDecode(authority, out var authorityBytes) || authorityBytes.Length != 32)
        {
            throw new InvalidOperationException("Authority must decode to 32 bytes.");
        }

        var data = new byte[165];
        mintBytes.CopyTo(data, 0);
        authorityBytes.CopyTo(data, 32);
        BinaryPrimitives.WriteUInt64LittleEndian(data.AsSpan(64, 8), amount);
        return data;
    }

    private static byte[] BuildPumpFunBondingCurveAccountData(bool complete)
    {
        var data = new byte[49];
        var fullDiscriminator = SHA256.HashData(Encoding.UTF8.GetBytes("account:BondingCurve"));
        fullDiscriminator.AsSpan(0, 8).CopyTo(data.AsSpan(0, 8));
        data[48] = complete ? (byte)1 : (byte)0;
        return data;
    }

    private sealed class CoordinatedLargestTokenAccountAnalysisService : ILargestTokenAccountAnalysisService
    {
        private readonly TaskCompletionSource<bool> _started;
        private readonly TaskCompletionSource<bool> _release;

        public CoordinatedLargestTokenAccountAnalysisService(
            TaskCompletionSource<bool> started,
            TaskCompletionSource<bool> release)
        {
            _started = started;
            _release = release;
        }

        public async Task<LargestTokenAccountsAnalysis?> AnalyzeAsync(
            string mint,
            string mintProgramId,
            ulong mintSupply,
            CancellationToken cancellationToken)
        {
            _started.TrySetResult(true);
            await _release.Task.WaitAsync(cancellationToken);

            return new LargestTokenAccountsAnalysis(
                LargestAccountBalances: new[] { mintSupply },
                LargestTokenAccounts: new[]
                {
                    new AnalyzedTokenAccount(
                        Address: "Largest111",
                        Authority: null,
                        Mint: mint,
                        TokenProgram: mintProgramId,
                        RawAmount: mintSupply.ToString(),
                        Percentage: 100m,
                        Classification: new TokenAccountClassification(
                            Classification: TokenAccountClassificationConstants.Unknown,
                            Protocol: null,
                            Confidence: TokenAccountClassificationConstants.UnknownConfidence,
                            Evidence: Array.Empty<TokenAccountClassificationEvidence>()))
                },
                PumpFunContext: null,
                UnclassifiedTokenAccountConcentration: new UnclassifiedTokenAccountConcentration(
                    ClassifiedProtocolPercentage: 0m,
                    UnknownPercentageWithinReportedLargestAccounts: 100m,
                    LargestUnknownTokenAccountPercentage: 100m,
                    Top5UnknownTokenAccountsPercentage: 100m,
                    SemanticsNote: "test"));
        }
    }

    private sealed class CoordinatedTokenMetadataResolver : ITokenMetadataResolver
    {
        private readonly TaskCompletionSource<bool> _started;
        private readonly TaskCompletionSource<bool> _release;

        public CoordinatedTokenMetadataResolver(
            TaskCompletionSource<bool> started,
            TaskCompletionSource<bool> release)
        {
            _started = started;
            _release = release;
        }

        public async Task<TokenMetadataResolution> ResolveAsync(
            string mint,
            string programId,
            byte[] mintAccountData,
            CancellationToken cancellationToken)
        {
            _started.TrySetResult(true);
            await _release.Task.WaitAsync(cancellationToken);
            return new TokenMetadataResolution("Token", "TOK", null, true);
        }
    }
}
