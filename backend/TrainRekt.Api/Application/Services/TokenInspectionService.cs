using System.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Analysis;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Infrastructure.Helius;
using TrainRekt.Api.Infrastructure.Solana;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenInspectionService : ITokenInspectionDeterministicService
{
    private const string HolderConcentrationSemantics = "Largest token account concentration based on getTokenLargestAccounts token-account balances. These percentages are not verified beneficial-owner concentration.";

    private readonly IHeliusClient _heliusClient;
    private readonly ITokenMetadataResolver _tokenMetadataResolver;
    private readonly ILargestTokenAccountAnalysisService _largestTokenAccountAnalysisService;
    private readonly ILogger<TokenInspectionService> _logger;

    public TokenInspectionService(IHeliusClient heliusClient)
        : this(
            heliusClient,
            new TokenMetadataResolver(heliusClient),
            new LargestTokenAccountAnalysisService(
                heliusClient,
                new ScopedSolanaAccountReader(heliusClient),
                new TokenAccountClassificationService(Array.Empty<ITokenAccountClassifier>())))
    {
    }

    public TokenInspectionService(
        IHeliusClient heliusClient,
        ITokenMetadataResolver tokenMetadataResolver,
        ILargestTokenAccountAnalysisService largestTokenAccountAnalysisService,
        ILogger<TokenInspectionService>? logger = null)
    {
        _heliusClient = heliusClient;
        _tokenMetadataResolver = tokenMetadataResolver;
        _largestTokenAccountAnalysisService = largestTokenAccountAnalysisService;
        _logger = logger ?? NullLogger<TokenInspectionService>.Instance;
    }

    public async Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
    {
        var totalStopwatch = Stopwatch.StartNew();
        long rpcMs = 0;
        long holderAnalysisMs = 0;
        long metadataMs = 0;

        if (!SolanaPublicKeyValidator.TryNormalize(mint, out var normalizedMint))
        {
            return TokenInspectionResult.Failure(
                TokenInspectionErrorCode.InvalidMint,
                "The provided mint is not a syntactically valid Solana public key.");
        }

        try
        {
            var rpcStopwatch = Stopwatch.StartNew();
            using var accountInfoResult = await _heliusClient.SendRpcRequestAsync(
                method: "getAccountInfo",
                parameters:
                [
                    normalizedMint,
                    new { encoding = "base64", commitment = "confirmed" }
                ],
                cancellationToken);
            rpcMs = ElapsedMilliseconds(rpcStopwatch);

            if (!HeliusRpcResponseReader.TryGetMintAccountInfo(
                    accountInfoResult.RootElement,
                    out var ownerProgramId,
                    out var accountDataBytes,
                    out var accountInfoError))
            {
                return accountInfoError switch
                {
                    TokenInspectionErrorCode.MintNotFound => TokenInspectionResult.Failure(
                        TokenInspectionErrorCode.MintNotFound,
                        "Mint account was not found."),
                    TokenInspectionErrorCode.NotFungibleTokenMint => TokenInspectionResult.Failure(
                        TokenInspectionErrorCode.NotFungibleTokenMint,
                        "The address does not belong to SPL Token or Token-2022 mint ownership."),
                    _ => TokenInspectionResult.Failure(
                        TokenInspectionErrorCode.ProviderMalformedResponse,
                        "RPC response did not include valid mint account data.")
                };
            }

            if (!SolanaMintParser.TryParse(ownerProgramId, accountDataBytes, out var parsedMint) || parsedMint is null)
            {
                return TokenInspectionResult.Failure(TokenInspectionErrorCode.NotFungibleTokenMint, "The account does not decode as a fungible token mint.");
            }

            var holderAnalysisStopwatch = Stopwatch.StartNew();
            var metadataStopwatch = Stopwatch.StartNew();

            var largestAccountAnalysisTask = _largestTokenAccountAnalysisService.AnalyzeAsync(
                normalizedMint,
                ownerProgramId,
                parsedMint.Supply,
                cancellationToken);

            var metadataTask = _tokenMetadataResolver.ResolveAsync(
                normalizedMint,
                ownerProgramId,
                accountDataBytes,
                cancellationToken);

            await Task.WhenAll(largestAccountAnalysisTask, metadataTask);

            holderAnalysisMs = ElapsedMilliseconds(holderAnalysisStopwatch);
            metadataMs = ElapsedMilliseconds(metadataStopwatch);

            var largestAccountAnalysis = await largestAccountAnalysisTask;

            if (largestAccountAnalysis is null)
            {
                return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderMalformedResponse, "RPC response did not include valid largest-token-account balances.");
            }

            var metadata = await metadataTask;

            if (!IsFungibleMint(parsedMint, metadata.IsFungibleByAsset))
            {
                return TokenInspectionResult.Failure(
                    TokenInspectionErrorCode.NotFungibleTokenMint,
                    "The supplied address does not appear to represent a fungible token mint.");
            }

            var (top1, top5, top10) = HolderConcentrationAnalyzer.Calculate(parsedMint.Supply, largestAccountAnalysis.LargestAccountBalances);

            var identity = new TokenIdentity(
                Mint: normalizedMint,
                Name: metadata.Name,
                Symbol: metadata.Symbol,
                Decimals: parsedMint.Decimals,
                SupplyRaw: parsedMint.Supply.ToString(),
                ProgramId: ownerProgramId,
                MetadataUri: metadata.MetadataUri,
                LogoUri: metadata.LogoUri);

            var authorities = new TokenAuthorities(
                MintAuthority: parsedMint.MintAuthority,
                MintAuthorityRevoked: parsedMint.MintAuthorityRevoked,
                FreezeAuthority: parsedMint.FreezeAuthority,
                FreezeAuthorityRevoked: parsedMint.FreezeAuthorityRevoked);

            var program = new TokenProgramInfo(
                ProgramType: ownerProgramId == SolanaTokenConstants.Token2022ProgramId ? "token-2022" : "spl-token",
                ProgramId: ownerProgramId,
                Token2022Extensions: parsedMint.Token2022Extensions);

            var age = new TokenAgeInfo(
                AgeSeconds: null,
                InferredCreatedAtUtc: null,
                IsReliable: false,
                UnavailableReason: "Reliable mint-creation time is not derived in this MVP because it would require historical signature scanning that can be expensive and ambiguous.");

            var concentration = new HolderConcentration(
                TopHolderPercentage: top1,
                Top5HoldersPercentage: top5,
                Top10HoldersPercentage: top10,
                SemanticsNote: HolderConcentrationSemantics,
                UnclassifiedTokenAccountConcentration: largestAccountAnalysis.UnclassifiedTokenAccountConcentration);

            var baseInspection = new TokenInspection(
                Identity: identity,
                Authorities: authorities,
                Program: program,
                Age: age,
                HolderConcentration: concentration,
                LargestTokenAccounts: largestAccountAnalysis.LargestTokenAccounts,
                PumpFunContext: largestAccountAnalysis.PumpFunContext,
                ProtocolContext: null,
                ReviewSignals: Array.Empty<TokenReviewSignal>(),
                InspectedAtUtc: DateTimeOffset.UtcNow);

            var protocolContext = ProtocolResearchContextFactory.Create(baseInspection);
            var withProtocolContext = baseInspection with { ProtocolContext = protocolContext };

            var reviewSignals = TokenReviewSignalFactory.Create(withProtocolContext);
            var inspection = withProtocolContext with { ReviewSignals = reviewSignals };

            var deterministicInspectionMs = ElapsedMilliseconds(totalStopwatch);
            _logger.LogInformation(
                "Token inspection timing for mint {Mint}: totalMs={TotalMs} deterministicInspectionMs={DeterministicInspectionMs} rpcMs={RpcMs} holderAnalysisMs={HolderAnalysisMs} metadataMs={MetadataMs}.",
                normalizedMint,
                deterministicInspectionMs,
                deterministicInspectionMs,
                rpcMs,
                holderAnalysisMs,
                metadataMs);

            return TokenInspectionResult.Success(inspection);
        }
        catch (OperationCanceledException)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.Cancelled, "The token inspection request was cancelled.");
        }
        catch (HeliusRpcException exception) when (exception.Kind is HeliusRpcFailureKind.Transport or HeliusRpcFailureKind.RateLimited)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderUnavailable, "Helius RPC is temporarily unavailable. Please try again.");
        }
        catch (HeliusRpcException exception) when (exception.Kind == HeliusRpcFailureKind.ProviderError)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderRejectedRequest, "Helius RPC rejected the token-inspection request payload.");
        }
        catch (InvalidOperationException)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderUnavailable, "Helius configuration is missing for this endpoint.");
        }
        catch (HeliusRpcException)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderMalformedResponse, "Helius RPC returned malformed data.");
        }
        catch (Exception)
        {
            return TokenInspectionResult.Failure(TokenInspectionErrorCode.ProviderMalformedResponse, "Token inspection failed due to unexpected provider data.");
        }
    }

    private static bool IsFungibleMint(ParsedMintAccount parsedMint, bool? fungibleByAsset)
    {
        if (fungibleByAsset is not null)
        {
            return fungibleByAsset.Value;
        }

        return !(parsedMint.Decimals == 0 && parsedMint.Supply <= 1UL);
    }

    private static long ElapsedMilliseconds(Stopwatch stopwatch)
    {
        return (long)Math.Round(stopwatch.Elapsed.TotalMilliseconds, MidpointRounding.AwayFromZero);
    }
}
