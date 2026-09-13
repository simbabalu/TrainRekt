using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TrainRekt.Api.Application.Research;

public sealed record ContentNormalizationResult(
    bool Success,
    string? Text,
    IReadOnlyList<string> JsonMintFieldValues,
    ResearchSourceAssessmentReason Reason);

public sealed class ResearchContentNormalizer
{
    private static readonly Regex ScriptStyleRegex = new("<script[\\s\\S]*?</script>|<style[\\s\\S]*?</style>", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex TagRegex = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex WhitespaceRegex = new("\\s+", RegexOptions.Compiled);

    public ContentNormalizationResult Normalize(string? contentType, string content)
    {
        var mediaType = contentType?.Split(';', 2, StringSplitOptions.TrimEntries)[0].Trim().ToLowerInvariant();

        if (mediaType == "application/json")
        {
            return NormalizeJson(content);
        }

        if (mediaType == "text/html")
        {
            var withoutScripts = ScriptStyleRegex.Replace(content, " ");
            var withoutTags = TagRegex.Replace(withoutScripts, " ");
            var decoded = System.Net.WebUtility.HtmlDecode(withoutTags);
            var normalized = WhitespaceRegex.Replace(decoded, " ").Trim();
            return new ContentNormalizationResult(true, normalized, Array.Empty<string>(), ResearchSourceAssessmentReason.None);
        }

        if (mediaType is "text/plain" or "text/markdown" or "text/x-markdown" or "text/md" or "application/markdown")
        {
            var normalized = WhitespaceRegex.Replace(content, " ").Trim();
            return new ContentNormalizationResult(true, normalized, Array.Empty<string>(), ResearchSourceAssessmentReason.None);
        }

        return new ContentNormalizationResult(false, null, Array.Empty<string>(), ResearchSourceAssessmentReason.UnsupportedContentType);
    }

    private static ContentNormalizationResult NormalizeJson(string content)
    {
        try
        {
            using var json = JsonDocument.Parse(content, new JsonDocumentOptions
            {
                MaxDepth = 32,
                AllowTrailingCommas = true
            });

            var builder = new StringBuilder();
            var mintFieldValues = new List<string>();
            CollectJsonStrings(json.RootElement, null, builder, mintFieldValues);
            var normalized = WhitespaceRegex.Replace(builder.ToString(), " ").Trim();
            return new ContentNormalizationResult(true, normalized, mintFieldValues, ResearchSourceAssessmentReason.None);
        }
        catch (JsonException)
        {
            return new ContentNormalizationResult(false, null, Array.Empty<string>(), ResearchSourceAssessmentReason.MalformedContent);
        }
    }

    private static void CollectJsonStrings(JsonElement element, string? propertyName, StringBuilder builder, List<string> mintFieldValues)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    CollectJsonStrings(property.Value, property.Name, builder, mintFieldValues);
                }
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    CollectJsonStrings(item, propertyName, builder, mintFieldValues);
                }
                break;
            case JsonValueKind.String:
                var value = element.GetString();
                if (!string.IsNullOrWhiteSpace(value))
                {
                    builder.Append(' ').Append(value);

                    if (!string.IsNullOrWhiteSpace(propertyName)
                        && propertyName.Contains("mint", StringComparison.OrdinalIgnoreCase))
                    {
                        mintFieldValues.Add(value);
                    }
                }
                break;
        }
    }
}
