using System.Text.Json;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;
using TrainRekt.Api.Domain.Utils;

namespace TrainRekt.Api.Application.Services;

public sealed class OnChainChronologyService : IOnChainChronologyService
{
    private const string Source = "HELIUS_SOLANA_RPC";

    private readonly IHeliusClient _heliusClient;
    private readonly ITokenIdentityChronologySnapshotRepository _snapshotRepository;
    private readonly OnChainChronologyOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<OnChainChronologyService> _logger;

    public OnChainChronologyService(
        IHeliusClient heliusClient,
        ITokenIdentityChronologySnapshotRepository snapshotRepository,
        IOptions<OnChainChronologyOptions> options,
        TimeProvider timeProvider,
        ILogger<OnChainChronologyService> logger)
    {
        _heliusClient = heliusClient;
        _snapshotRepository = snapshotRepository;
        _options = options.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<OnChainChronologyEvidence> AnalyzeAsync(string mint, CancellationToken cancellationToken)
    {
        if (!SolanaPublicKeyValidator.TryNormalize(mint, out var normalizedMint))
        {
            return CreateUnavailable(
                OnChainChronologyCoverage.Unavailable,
                includeProviderRetentionUnknown: false,
                includeHistoryPartialUnknown: false,
                paginationExhausted: false,
                pagesScanned: 0);
        }

        var nowUtc = _timeProvider.GetUtcNow();

        try
        {
            var cached = await _snapshotRepository.GetFreshAsync(
                normalizedMint,
                TokenIdentityChronologyVersion.Current,
                nowUtc,
                cancellationToken);
            if (cached is not null)
            {
                return cached.Evidence;
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "On-chain chronology cache read failed for mint {Mint}. Returning safe unavailable chronology to prevent uncontrolled provider fallback.",
                normalizedMint);
            return CreateUnavailable(
                OnChainChronologyCoverage.Unavailable,
                includeProviderRetentionUnknown: false,
                includeHistoryPartialUnknown: false,
                paginationExhausted: false,
                pagesScanned: 0);
        }

        var evidence = await AnalyzeViaProviderAsync(normalizedMint, cancellationToken);

        var expiresAtUtc = nowUtc.Add(GetFreshnessDuration(evidence.HistoryCoverage));
        var snapshot = new CachedTokenIdentityChronologySnapshot(
            Id: string.Empty,
            Mint: normalizedMint,
            ChronologyVersion: TokenIdentityChronologyVersion.Current,
            AnalyzedAtUtc: evidence.AnalyzedAtUtc,
            CachedAtUtc: nowUtc,
            ExpiresAtUtc: expiresAtUtc,
            Evidence: evidence);

        try
        {
            await _snapshotRepository.InsertAsync(snapshot, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "On-chain chronology cache write failed for mint {Mint}. Returning current valid chronology evidence.",
                normalizedMint);
        }

        return evidence;
    }

    private async Task<OnChainChronologyEvidence> AnalyzeViaProviderAsync(string mint, CancellationToken cancellationToken)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(_options.TimeoutSeconds));

        var signatures = new Dictionary<string, ParsedSignatureRow>(StringComparer.Ordinal);
        var pagesScanned = 0;
        var usableRowsCount = 0;
        var paginationExhausted = false;
        var before = (string?)null;

        try
        {
            while (pagesScanned < _options.MaxPages && usableRowsCount < _options.MaxSignatures)
            {
                var response = await _heliusClient.SendRpcRequestAsync(
                    method: "getSignaturesForAddress",
                    parameters: CreateParams(mint, before),
                    cancellationToken: timeoutCts.Token);

                using (response)
                {
                    pagesScanned += 1;

                    var rows = ParseRows(response.RootElement);
                    if (rows.Count == 0)
                    {
                        paginationExhausted = true;
                        break;
                    }

                    foreach (var row in rows)
                    {
                        if (signatures.ContainsKey(row.Signature))
                        {
                            continue;
                        }

                        signatures[row.Signature] = row;
                        usableRowsCount += 1;
                        if (usableRowsCount >= _options.MaxSignatures)
                        {
                            break;
                        }
                    }

                    if (!TryGetContinuationSignature(rows, out var continuationSignature))
                    {
                        paginationExhausted = true;
                        break;
                    }

                    before = continuationSignature;
                    if (rows.Count < _options.PageSize)
                    {
                        paginationExhausted = true;
                        break;
                    }
                }
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            if (signatures.Count == 0)
            {
                return CreateUnavailable(
                    OnChainChronologyCoverage.Unavailable,
                    includeProviderRetentionUnknown: false,
                    includeHistoryPartialUnknown: false,
                    paginationExhausted: false,
                    pagesScanned: pagesScanned);
            }

            return BuildEvidence(
                signatures.Values,
                pagesScanned,
                usableRowsCount,
                paginationExhausted: false,
                historyCoverage: OnChainChronologyCoverage.PartialTimeout,
                includeHistoryPartialUnknown: true);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "On-chain chronology provider query failed for mint {Mint} after {PagesScanned} pages and {SignaturesScanned} signatures.",
                mint,
                pagesScanned,
                usableRowsCount);

            if (signatures.Count == 0)
            {
                return CreateUnavailable(
                    OnChainChronologyCoverage.Unavailable,
                    includeProviderRetentionUnknown: false,
                    includeHistoryPartialUnknown: false,
                    paginationExhausted: false,
                    pagesScanned: pagesScanned);
            }

            return BuildEvidence(
                signatures.Values,
                pagesScanned,
                usableRowsCount,
                paginationExhausted: false,
                historyCoverage: OnChainChronologyCoverage.PartialProviderFailure,
                includeHistoryPartialUnknown: true);
        }

        if (signatures.Count == 0)
        {
            return CreateUnavailable(
                OnChainChronologyCoverage.Unavailable,
                includeProviderRetentionUnknown: false,
                includeHistoryPartialUnknown: false,
                paginationExhausted: paginationExhausted,
                pagesScanned: pagesScanned);
        }

        if (paginationExhausted)
        {
            return BuildEvidence(
                signatures.Values,
                pagesScanned,
                usableRowsCount,
                paginationExhausted: true,
                historyCoverage: OnChainChronologyCoverage.CompleteWithinProviderResult,
                includeHistoryPartialUnknown: false);
        }

        if (usableRowsCount >= _options.MaxSignatures)
        {
            return BuildEvidence(
                signatures.Values,
                pagesScanned,
                usableRowsCount,
                paginationExhausted: false,
                historyCoverage: OnChainChronologyCoverage.PartialSignatureLimit,
                includeHistoryPartialUnknown: true);
        }

        return BuildEvidence(
            signatures.Values,
            pagesScanned,
            usableRowsCount,
            paginationExhausted: false,
            historyCoverage: OnChainChronologyCoverage.PartialPageLimit,
            includeHistoryPartialUnknown: true);
    }

    private IReadOnlyList<object?> CreateParams(string mint, string? before)
    {
        var config = before is null
            ? new Dictionary<string, object?>
            {
                ["limit"] = _options.PageSize
            }
            : new Dictionary<string, object?>
            {
                ["limit"] = _options.PageSize,
                ["before"] = before
            };

        return new object?[]
        {
            mint,
            config
        };
    }

    private static List<ParsedSignatureRow> ParseRows(JsonElement root)
    {
        if (!root.TryGetProperty("result", out var result)
            || result.ValueKind != JsonValueKind.Array)
        {
            return new List<ParsedSignatureRow>();
        }

        var rows = new List<ParsedSignatureRow>();
        foreach (var row in result.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (!row.TryGetProperty("signature", out var signatureElement)
                || signatureElement.ValueKind != JsonValueKind.String)
            {
                continue;
            }

            var signature = signatureElement.GetString();
            if (string.IsNullOrWhiteSpace(signature))
            {
                continue;
            }

            if (!row.TryGetProperty("slot", out var slotElement)
                || slotElement.ValueKind != JsonValueKind.Number
                || !slotElement.TryGetInt64(out var slot))
            {
                continue;
            }

            DateTimeOffset? blockTimeUtc = null;
            if (row.TryGetProperty("blockTime", out var blockTimeElement)
                && blockTimeElement.ValueKind == JsonValueKind.Number
                && blockTimeElement.TryGetInt64(out var blockTimeEpoch))
            {
                blockTimeUtc = DateTimeOffset.FromUnixTimeSeconds(blockTimeEpoch);
            }

            rows.Add(new ParsedSignatureRow(signature, slot, blockTimeUtc));
        }

        return rows;
    }

    private static bool TryGetContinuationSignature(IReadOnlyList<ParsedSignatureRow> rows, out string? continuationSignature)
    {
        continuationSignature = rows.Count == 0 ? null : rows[^1].Signature;
        return !string.IsNullOrWhiteSpace(continuationSignature);
    }

    private OnChainChronologyEvidence BuildEvidence(
        IEnumerable<ParsedSignatureRow> rows,
        int pagesScanned,
        int signaturesScanned,
        bool paginationExhausted,
        OnChainChronologyCoverage historyCoverage,
        bool includeHistoryPartialUnknown)
    {
        var earliest = rows
            .OrderBy(entry => entry.Slot)
            .ThenBy(entry => entry.Signature, StringComparer.Ordinal)
            .First();

        var unknowns = new List<OnChainChronologyUnknown>
        {
            OnChainChronologyUnknown.CanonicalCreationTimeNotProven,
            OnChainChronologyUnknown.ProviderRetentionUnknown
        };

        if (includeHistoryPartialUnknown)
        {
            unknowns.Add(OnChainChronologyUnknown.ChainHistoryPartial);
        }

        var precision = earliest.BlockTimeUtc is null
            ? OnChainChronologyPrecision.SlotOnly
            : OnChainChronologyPrecision.BlockTime;

        if (earliest.BlockTimeUtc is null)
        {
            unknowns.Add(OnChainChronologyUnknown.BlockTimeUnavailable);
        }

        var confidence = historyCoverage switch
        {
            OnChainChronologyCoverage.CompleteWithinProviderResult when precision == OnChainChronologyPrecision.BlockTime => OnChainChronologyConfidence.High,
            OnChainChronologyCoverage.CompleteWithinProviderResult => OnChainChronologyConfidence.Medium,
            OnChainChronologyCoverage.PartialProviderFailure or OnChainChronologyCoverage.PartialTimeout => OnChainChronologyConfidence.Low,
            _ => OnChainChronologyConfidence.Low
        };

        return new OnChainChronologyEvidence(
            EarliestObservedSignature: earliest.Signature,
            EarliestObservedSlot: earliest.Slot,
            EarliestObservedBlockTimeUtc: earliest.BlockTimeUtc,
            HistoryCoverage: historyCoverage,
            PaginationExhausted: paginationExhausted,
            PagesScanned: pagesScanned,
            SignaturesScanned: signaturesScanned,
            Source: Source,
            Confidence: confidence,
            Precision: precision,
            AccountCreationProven: false,
            Unknowns: unknowns,
            AnalyzedAtUtc: _timeProvider.GetUtcNow());
    }

    private OnChainChronologyEvidence CreateUnavailable(
        OnChainChronologyCoverage coverage,
        bool includeProviderRetentionUnknown,
        bool includeHistoryPartialUnknown,
        bool paginationExhausted,
        int pagesScanned)
    {
        var unknowns = new List<OnChainChronologyUnknown>
        {
            OnChainChronologyUnknown.CanonicalCreationTimeNotProven,
            OnChainChronologyUnknown.ChainHistoryUnavailable
        };

        if (includeProviderRetentionUnknown)
        {
            unknowns.Add(OnChainChronologyUnknown.ProviderRetentionUnknown);
        }

        if (includeHistoryPartialUnknown)
        {
            unknowns.Add(OnChainChronologyUnknown.ChainHistoryPartial);
        }

        return new OnChainChronologyEvidence(
            EarliestObservedSignature: null,
            EarliestObservedSlot: null,
            EarliestObservedBlockTimeUtc: null,
            HistoryCoverage: coverage,
            PaginationExhausted: paginationExhausted,
            PagesScanned: pagesScanned,
            SignaturesScanned: 0,
            Source: Source,
            Confidence: OnChainChronologyConfidence.None,
            Precision: OnChainChronologyPrecision.ObservedTransactionOnly,
            AccountCreationProven: false,
            Unknowns: unknowns,
            AnalyzedAtUtc: _timeProvider.GetUtcNow());
    }

    private TimeSpan GetFreshnessDuration(OnChainChronologyCoverage coverage)
    {
        return coverage switch
        {
            OnChainChronologyCoverage.CompleteWithinProviderResult => TimeSpan.FromHours(_options.CompleteFreshnessHours),
            OnChainChronologyCoverage.PartialProviderFailure or OnChainChronologyCoverage.PartialTimeout or OnChainChronologyCoverage.Unavailable => TimeSpan.FromMinutes(_options.FailureFreshnessMinutes),
            _ => TimeSpan.FromMinutes(_options.PartialFreshnessMinutes)
        };
    }

    private sealed record ParsedSignatureRow(string Signature, long Slot, DateTimeOffset? BlockTimeUtc);
}
