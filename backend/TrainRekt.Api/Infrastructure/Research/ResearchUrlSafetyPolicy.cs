using System.Globalization;
using System.Net;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;

namespace TrainRekt.Api.Infrastructure.Research;

public sealed record UrlSafetyValidationResult(
    bool IsAllowed,
    Uri? NormalizedUri,
    IReadOnlyList<IPAddress> ResolvedAddresses,
    string? NormalizedHost,
    ResearchSourceAssessmentReason Reason,
    string? Detail);

public sealed class ResearchUrlSafetyPolicy
{
    private readonly IResearchDnsResolver _dnsResolver;
    private readonly TokenResearchOptions _options;

    public ResearchUrlSafetyPolicy(IResearchDnsResolver dnsResolver, IOptions<TokenResearchOptions> options)
    {
        _dnsResolver = dnsResolver;
        _options = options.Value;
    }

    public async Task<UrlSafetyValidationResult> ValidateAsync(Uri uri, CancellationToken cancellationToken)
    {
        if (!uri.IsAbsoluteUri)
        {
            return Reject(ResearchSourceAssessmentReason.InvalidUrl, "URL must be absolute.");
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return Reject(ResearchSourceAssessmentReason.UnsupportedScheme, "Only HTTPS is supported.");
        }

        if (!string.IsNullOrWhiteSpace(uri.UserInfo))
        {
            return Reject(ResearchSourceAssessmentReason.UrlContainsCredentials, "URL credentials are not allowed.");
        }

        if (!_options.AllowedHttpsPorts.Contains(uri.Port))
        {
            return Reject(ResearchSourceAssessmentReason.UnsupportedPort, "URL port is not allowed.");
        }

        var normalizedHost = NormalizeHost(uri.Host);
        if (normalizedHost is null)
        {
            return Reject(ResearchSourceAssessmentReason.InvalidUrl, "Host normalization failed.");
        }

        if (string.Equals(normalizedHost, "localhost", StringComparison.OrdinalIgnoreCase))
        {
            return Reject(ResearchSourceAssessmentReason.PrivateNetworkTarget, "localhost is not allowed.");
        }

        if (IPAddress.TryParse(normalizedHost, out var parsedIp))
        {
            if (IsProhibitedAddress(parsedIp))
            {
                return Reject(ResearchSourceAssessmentReason.PrivateNetworkTarget, "Target IP is in a prohibited range.");
            }

            return new UrlSafetyValidationResult(
                IsAllowed: true,
                NormalizedUri: BuildNormalizedUri(uri, normalizedHost),
                ResolvedAddresses: new[] { parsedIp },
                NormalizedHost: normalizedHost,
                Reason: ResearchSourceAssessmentReason.None,
                Detail: null);
        }

        var resolved = await _dnsResolver.ResolveAsync(normalizedHost, cancellationToken);
        if (resolved.Count == 0)
        {
            return Reject(ResearchSourceAssessmentReason.DnsResolutionRejected, "Hostname did not resolve.");
        }

        // Fail-closed policy: if any DNS answer is prohibited, reject the host.
        // This reduces DNS-rebinding risk without introducing a false sense of safety.
        if (resolved.Any(IsProhibitedAddress))
        {
            return Reject(ResearchSourceAssessmentReason.DnsResolutionRejected, "One or more DNS answers are prohibited.");
        }

        return new UrlSafetyValidationResult(
            IsAllowed: true,
            NormalizedUri: BuildNormalizedUri(uri, normalizedHost),
            ResolvedAddresses: resolved,
            NormalizedHost: normalizedHost,
            Reason: ResearchSourceAssessmentReason.None,
            Detail: null);
    }

    private static UrlSafetyValidationResult Reject(ResearchSourceAssessmentReason reason, string detail)
    {
        return new UrlSafetyValidationResult(false, null, Array.Empty<IPAddress>(), null, reason, detail);
    }

    private static Uri BuildNormalizedUri(Uri uri, string normalizedHost)
    {
        var builder = new UriBuilder(uri)
        {
            Host = normalizedHost,
            Port = uri.Port
        };

        return builder.Uri;
    }

    private static string? NormalizeHost(string host)
    {
        if (string.IsNullOrWhiteSpace(host))
        {
            return null;
        }

        try
        {
            var idn = new IdnMapping();
            return idn.GetAscii(host).ToLowerInvariant();
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private static bool IsProhibitedAddress(IPAddress address)
    {
        if (IPAddress.IsLoopback(address)
            || address.Equals(IPAddress.Any)
            || address.Equals(IPAddress.IPv6Any)
            || address.Equals(IPAddress.IPv6Loopback))
        {
            return true;
        }

        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            var bytes = address.GetAddressBytes();

            if (bytes[0] == 10)
            {
                return true;
            }

            if (bytes[0] == 127)
            {
                return true;
            }

            if (bytes[0] == 169 && bytes[1] == 254)
            {
                return true;
            }

            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
            {
                return true;
            }

            if (bytes[0] == 192 && bytes[1] == 168)
            {
                return true;
            }

            if (bytes[0] >= 224)
            {
                return true;
            }

            return false;
        }

        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            if (address.IsIPv6LinkLocal
                || address.IsIPv6Multicast
                || address.IsIPv6SiteLocal)
            {
                return true;
            }

            var bytes = address.GetAddressBytes();
            if ((bytes[0] & 0b1111_1110) == 0b1111_1100)
            {
                return true;
            }

            return false;
        }

        return true;
    }
}
