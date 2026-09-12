namespace TrainRekt.Api.Application.Abstractions;

public sealed record SolanaAccountInfo(
    string OwnerProgramId,
    byte[] Data);

public interface ISolanaAccountReader
{
    Task<SolanaAccountInfo?> GetAccountInfoAsync(string address, CancellationToken cancellationToken);
}
