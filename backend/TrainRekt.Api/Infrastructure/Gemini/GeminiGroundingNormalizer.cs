namespace TrainRekt.Api.Infrastructure.Gemini;

public sealed class GeminiGroundingNormalizer
{
    public IReadOnlyList<GeminiCitation> Normalize(IReadOnlyList<GeminiCitation> citations)
    {
        var dedup = new Dictionary<string, GeminiCitation>(StringComparer.OrdinalIgnoreCase);

        foreach (var citation in citations)
        {
            if (!TryNormalizeUrl(citation.Url, out var normalizedUrl))
            {
                continue;
            }

            dedup.TryAdd(normalizedUrl, new GeminiCitation(normalizedUrl, citation.Title));
        }

        return dedup.Values
            .OrderBy(source => source.Url, StringComparer.Ordinal)
            .ToArray();
    }

    private static bool TryNormalizeUrl(string url, out string normalized)
    {
        normalized = string.Empty;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (TryUnwrapGoogleRedirect(uri, out var destinationUri))
        {
            uri = destinationUri;
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var builder = new UriBuilder(uri)
        {
            Fragment = string.Empty
        };

        normalized = builder.Uri.AbsoluteUri;
        return true;
    }

    private static bool TryUnwrapGoogleRedirect(Uri uri, out Uri destinationUri)
    {
        destinationUri = uri;

        if (!uri.Host.Equals("www.google.com", StringComparison.OrdinalIgnoreCase)
            && !uri.Host.Equals("google.com", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!uri.AbsolutePath.Equals("/url", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(uri.Query);
        var encoded = query.TryGetValue("url", out var urlValue)
            ? urlValue.ToString()
            : query.TryGetValue("q", out var qValue)
                ? qValue.ToString()
                : null;
        if (string.IsNullOrWhiteSpace(encoded)
            || !Uri.TryCreate(encoded, UriKind.Absolute, out var parsed)
            || !string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        destinationUri = parsed;
        return true;
    }
}
