using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public sealed record TokenMetadataResolution(
    string? Name,
    string? Symbol,
    string? MetadataUri,
    bool? IsFungibleByAsset);

public sealed record LargestTokenAccountEntry(string Address, ulong AmountRaw);

public sealed record LargestTokenAccountsAnalysis(
    IReadOnlyList<ulong> LargestAccountBalances,
    IReadOnlyList<AnalyzedTokenAccount> LargestTokenAccounts,
    PumpFunContext? PumpFunContext,
    UnclassifiedTokenAccountConcentration UnclassifiedTokenAccountConcentration);

public interface ITokenMetadataResolver
{
    Task<TokenMetadataResolution> ResolveAsync(
        string mint,
        string programId,
        byte[] mintAccountData,
        CancellationToken cancellationToken);
}

public interface ILargestTokenAccountAnalysisService
{
    Task<LargestTokenAccountsAnalysis?> AnalyzeAsync(
        string mint,
        string mintProgramId,
        ulong mintSupply,
        CancellationToken cancellationToken);
}
