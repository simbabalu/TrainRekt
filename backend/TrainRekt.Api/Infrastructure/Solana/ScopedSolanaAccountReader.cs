using System.Collections.Concurrent;
using System.Threading;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Helius;

namespace TrainRekt.Api.Infrastructure.Solana;

public sealed class ScopedSolanaAccountReader : ISolanaAccountReader
{
    private readonly IHeliusClient _heliusClient;
    private readonly ConcurrentDictionary<string, Lazy<Task<SolanaAccountInfo?>>> _accountCache = new(StringComparer.Ordinal);

    public ScopedSolanaAccountReader(IHeliusClient heliusClient)
    {
        _heliusClient = heliusClient;
    }

    public async Task<SolanaAccountInfo?> GetAccountInfoAsync(string address, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(address);
        cancellationToken.ThrowIfCancellationRequested();

        var accountTask = _accountCache.GetOrAdd(
            address,
            key => new Lazy<Task<SolanaAccountInfo?>>(
                () => LoadAccountInfoAsync(key),
                LazyThreadSafetyMode.ExecutionAndPublication));

        return await accountTask.Value.WaitAsync(cancellationToken);
    }

    private async Task<SolanaAccountInfo?> LoadAccountInfoAsync(string address)
    {
        using var accountInfo = await _heliusClient.SendRpcRequestAsync(
            method: "getAccountInfo",
            parameters:
            [
                address,
                new { encoding = "base64", commitment = "confirmed" }
            ],
            CancellationToken.None);

        if (!HeliusRpcResponseReader.TryReadGenericAccountInfo(accountInfo.RootElement, out var ownerProgramId, out var data))
        {
            return null;
        }

        return new SolanaAccountInfo(ownerProgramId, data);
    }
}
