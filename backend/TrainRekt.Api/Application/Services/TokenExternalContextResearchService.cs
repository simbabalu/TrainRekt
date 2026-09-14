using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenExternalContextResearchService : ITokenExternalContextResearchService
{
    private readonly ITokenExternalContextProvider _provider;
    private readonly TokenExternalContextOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<TokenExternalContextResearchService> _logger;

    private readonly object _gate = new();
    private readonly Dictionary<string, CachedEntry> _cache = new(StringComparer.Ordinal);

    public TokenExternalContextResearchService(
        ITokenExternalContextProvider provider,
        IOptions<TokenExternalContextOptions> options,
        TimeProvider timeProvider,
        ILogger<TokenExternalContextResearchService> logger)
    {
        _provider = provider;
        _options = options.Value;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<TokenExternalContext> GetContextAsync(
        TokenInspection inspection,
        TokenIdentityProvenance? provenance,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        _logger.LogInformation("External context research service invoked for mint {Mint}.", inspection.Identity.Mint);

        if (!_options.Enabled)
        {
            _logger.LogInformation("External context research disabled for mint {Mint}.", inspection.Identity.Mint);
            return new TokenExternalContext(
                TokenExternalContextAvailability.Disabled,
                TokenExternalAssetType.Unknown,
                null,
                null,
                "NONE",
                false,
                false,
                Array.Empty<TokenExternalContextEvidence>(),
                TokenExternalContextFailureReason.Disabled);
        }

        var nowUtc = _timeProvider.GetUtcNow();
        if (TryGetFreshCache(inspection.Identity.Mint, nowUtc, out var cached))
        {
            _logger.LogInformation(
                "External context research cache hit for mint {Mint}. availability={Availability} assetType={AssetType} mintConfirmed={MintConfirmed} confidence={Confidence} evidenceCount={EvidenceCount}.",
                inspection.Identity.Mint,
                cached.Availability,
                cached.AssetType,
                cached.MintConfirmed,
                cached.Confidence,
                cached.Evidence.Count);
            return cached;
        }

        var request = BuildRequest(inspection, provenance);

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(_options.TimeoutSeconds));

        TokenExternalContext result;
        try
        {
            result = await _provider.ResearchAsync(request, timeoutCts.Token);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("External context research unavailable for mint {Mint}. category=timeout.", inspection.Identity.Mint);
            result = new TokenExternalContext(
                TokenExternalContextAvailability.Unavailable,
                TokenExternalAssetType.Unknown,
                null,
                null,
                "LOW",
                false,
                false,
                Array.Empty<TokenExternalContextEvidence>(),
                TokenExternalContextFailureReason.Timeout);
        }
        catch (HttpRequestException)
        {
            _logger.LogWarning("External context research unavailable for mint {Mint}. category=network-failure.", inspection.Identity.Mint);
            result = new TokenExternalContext(
                TokenExternalContextAvailability.Unavailable,
                TokenExternalAssetType.Unknown,
                null,
                null,
                "LOW",
                false,
                false,
                Array.Empty<TokenExternalContextEvidence>(),
                TokenExternalContextFailureReason.NetworkFailure);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "External context enrichment failed for mint {Mint}. Continuing with deterministic coach input only.",
                inspection.Identity.Mint);

            result = new TokenExternalContext(
                TokenExternalContextAvailability.Unavailable,
                TokenExternalAssetType.Unknown,
                null,
                null,
                "LOW",
                false,
                false,
                Array.Empty<TokenExternalContextEvidence>(),
                TokenExternalContextFailureReason.Unknown);
        }

        result = Bound(result);

        _logger.LogInformation(
            "External context research completed for mint {Mint}. availability={Availability} assetType={AssetType} mintConfirmed={MintConfirmed} confidence={Confidence} evidenceCount={EvidenceCount} failureReason={FailureReason}.",
            inspection.Identity.Mint,
            result.Availability,
            result.AssetType,
            result.MintConfirmed,
            result.Confidence,
            result.Evidence.Count,
            result.FailureReason);

        if (ShouldCache(result))
        {
            SetCache(inspection.Identity.Mint, result, nowUtc.AddHours(_options.FreshnessHours));
        }

        return result;
    }

    private TokenExternalContextRequest BuildRequest(TokenInspection inspection, TokenIdentityProvenance? provenance)
    {
        var knownSources = new List<TokenExternalContextKnownSource>();

        if (inspection.ProtocolContext is not null)
        {
            foreach (var source in inspection.ProtocolContext.Sources)
            {
                knownSources.Add(new TokenExternalContextKnownSource(
                    source.Url,
                    MapSourceType(source.SourceType),
                    source.Publisher));
            }
        }

        if (provenance?.TrustedIdentityProvenance is not null)
        {
            foreach (var source in provenance.TrustedIdentityProvenance.Sources)
            {
                knownSources.Add(new TokenExternalContextKnownSource(
                    source.Url,
                    MapIdentitySourceType(source.SourceTrust),
                    source.Publisher));
            }
        }

        var deduped = knownSources
            .GroupBy(source => source.Url, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .Take(_options.MaxKnownOfficialUrls)
            .ToArray();

        return new TokenExternalContextRequest(
            inspection.Identity.Mint,
            inspection.Identity.Name,
            inspection.Identity.Symbol,
            inspection.Program.ProgramType,
            inspection.Authorities,
            deduped);
    }

    private TokenExternalContext Bound(TokenExternalContext context)
    {
        var projectName = Truncate(context.ProjectName, _options.MaxProjectNameLength);
        var summary = Truncate(context.Summary, _options.MaxSummaryLength);
        var boundedEvidence = context.Evidence
            .Take(_options.MaxEvidenceItems)
            .Select(item => new TokenExternalContextEvidence(
                item.SourceType,
                Truncate(item.Title, _options.MaxEvidenceTitleLength) ?? "unknown",
                Truncate(item.Domain, _options.MaxEvidenceTitleLength) ?? "unknown",
                Truncate(item.Claim, _options.MaxEvidenceClaimLength) ?? string.Empty,
                Truncate(item.Url, 2048)))
            .Where(item => !string.IsNullOrWhiteSpace(item.Claim))
            .ToArray();

        return context with
        {
            ProjectName = projectName,
            Summary = summary,
            Evidence = boundedEvidence
        };
    }

    private bool ShouldCache(TokenExternalContext context)
    {
        if (context.Availability == TokenExternalContextAvailability.Available)
        {
            return true;
        }

        return context.FailureReason is TokenExternalContextFailureReason.NoRelevantEvidence
            or TokenExternalContextFailureReason.AmbiguousEvidence;
    }

    private bool TryGetFreshCache(string mint, DateTimeOffset nowUtc, out TokenExternalContext context)
    {
        lock (_gate)
        {
            if (_cache.TryGetValue(mint, out var entry) && entry.ExpiresAtUtc > nowUtc)
            {
                context = entry.Context;
                return true;
            }

            if (entry is not null)
            {
                _cache.Remove(mint);
            }
        }

        context = default!;
        return false;
    }

    private void SetCache(string mint, TokenExternalContext context, DateTimeOffset expiresAtUtc)
    {
        lock (_gate)
        {
            if (_cache.Count >= _options.MaxCacheEntries)
            {
                var oldestKey = _cache.OrderBy(item => item.Value.ExpiresAtUtc).First().Key;
                _cache.Remove(oldestKey);
            }

            _cache[mint] = new CachedEntry(context, expiresAtUtc);
        }
    }

    private static TokenExternalContextSourceType MapSourceType(ResearchSourceType type)
    {
        return type switch
        {
            ResearchSourceType.ProjectWebsite => TokenExternalContextSourceType.OfficialProjectWebsite,
            ResearchSourceType.OfficialDocumentation => TokenExternalContextSourceType.OfficialDocumentation,
            ResearchSourceType.OfficialWhitepaper => TokenExternalContextSourceType.OfficialIssuerDocumentation,
            ResearchSourceType.OfficialRepository => TokenExternalContextSourceType.OfficialRepository,
            ResearchSourceType.OfficialIdl => TokenExternalContextSourceType.OfficialDocumentation,
            _ => TokenExternalContextSourceType.Other
        };
    }

    private static TokenExternalContextSourceType MapIdentitySourceType(IdentitySourceTrust trust)
    {
        return trust == IdentitySourceTrust.Trusted
            ? TokenExternalContextSourceType.ReputableExplorerOrIndexer
            : TokenExternalContextSourceType.Other;
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private sealed record CachedEntry(TokenExternalContext Context, DateTimeOffset ExpiresAtUtc);
}
