using System.Text.Json;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Infrastructure.Gemini;

public sealed class GeminiCandidateMapper
{
    private static readonly HashSet<string> AllowedObservedFactIds =
    [
        ObservedFactIds.MintAuthorityActive,
        ObservedFactIds.MintAuthorityAddress,
        ObservedFactIds.FreezeAuthorityActive,
        ObservedFactIds.FreezeAuthorityAddress,
        ObservedFactIds.LargestUnknownTokenAccountPercentage,
        ObservedFactIds.TokenAccountStakingVault,
        ObservedFactIds.ProgramStakingProgram
    ];

    private static readonly HashSet<string> ForbiddenFieldNames =
    [
        "verificationstatus",
        "verificationmethod",
        "verified",
        "deterministicreconciliation",
        "researchidentitymatch",
        "confirmed"
    ];

    private readonly TokenResearchOptions _researchOptions;

    public GeminiCandidateMapper(TokenResearchOptions researchOptions)
    {
        _researchOptions = researchOptions;
    }

    public GeminiClientResult<CandidateResearchResult> MapStructuredJson(string rawJson)
    {
        JsonDocument parsed;
        try
        {
            parsed = JsonDocument.Parse(rawJson);
        }
        catch (JsonException)
        {
            return Fail<CandidateResearchResult>(GeminiFailureReason.MalformedResponse, "Gemini extraction output was not valid JSON.");
        }

        using (parsed)
        {
            if (ContainsForbiddenField(parsed.RootElement))
            {
                return Fail<CandidateResearchResult>(GeminiFailureReason.SchemaViolation, "Extraction included forbidden authoritative fields.");
            }

            if (parsed.RootElement.ValueKind != JsonValueKind.Object)
            {
                return Fail<CandidateResearchResult>(GeminiFailureReason.SchemaViolation, "Extraction root must be a JSON object.");
            }

            if (!parsed.RootElement.TryGetProperty("sources", out var sourcesElement)
                || !parsed.RootElement.TryGetProperty("claims", out var claimsElement)
                || !parsed.RootElement.TryGetProperty("identityEvidence", out var identityElement)
                || sourcesElement.ValueKind != JsonValueKind.Array
                || claimsElement.ValueKind != JsonValueKind.Array
                || identityElement.ValueKind != JsonValueKind.Array)
            {
                return Fail<CandidateResearchResult>(GeminiFailureReason.SchemaViolation, "Extraction payload is missing required arrays.");
            }

            if (sourcesElement.GetArrayLength() > _researchOptions.MaxSources)
            {
                return Fail<CandidateResearchResult>(GeminiFailureReason.NoUsefulSources, "Extraction exceeded configured source limit.");
            }

            if (claimsElement.GetArrayLength() > _researchOptions.MaxClaims)
            {
                return Fail<CandidateResearchResult>(GeminiFailureReason.NoUsefulSources, "Extraction exceeded configured claim limit.");
            }

            var sources = new List<CandidateResearchSource>();
            var sourceIds = new HashSet<string>(StringComparer.Ordinal);

            foreach (var sourceElement in sourcesElement.EnumerateArray())
            {
                if (!TryParseSource(sourceElement, out var source))
                {
                    return Fail<CandidateResearchResult>(GeminiFailureReason.SchemaViolation, "Extraction source payload was invalid.");
                }

                if (!sourceIds.Add(source.Id))
                {
                    return Fail<CandidateResearchResult>(GeminiFailureReason.SchemaViolation, "Extraction sources contained duplicate IDs.");
                }

                sources.Add(source);
            }

            var claims = new List<CandidateDocumentedClaim>();
            var claimIds = new HashSet<string>(StringComparer.Ordinal);

            foreach (var claimElement in claimsElement.EnumerateArray())
            {
                if (!TryParseClaim(claimElement, sourceIds, out var claim))
                {
                    return Fail<CandidateResearchResult>(GeminiFailureReason.SchemaViolation, "Extraction claim payload was invalid.");
                }

                if (claim is null)
                {
                    continue;
                }

                if (!claimIds.Add(claim.Id))
                {
                    return Fail<CandidateResearchResult>(GeminiFailureReason.SchemaViolation, "Extraction claims contained duplicate IDs.");
                }

                claims.Add(claim);
            }

            var evidence = new List<CandidateIdentityEvidence>();
            foreach (var evidenceElement in identityElement.EnumerateArray())
            {
                if (!TryParseEvidence(evidenceElement, out var candidateEvidence))
                {
                    return Fail<CandidateResearchResult>(GeminiFailureReason.SchemaViolation, "Extraction identity evidence payload was invalid.");
                }

                if (candidateEvidence is not null)
                {
                    evidence.Add(candidateEvidence);
                }
            }

            var result = new CandidateResearchResult(
                IdentityEvidence: evidence,
                Sources: sources,
                Claims: claims);

            return new GeminiClientResult<CandidateResearchResult>(true, result, null, null);
        }
    }

    private bool TryParseSource(JsonElement sourceElement, out CandidateResearchSource source)
    {
        source = default!;
        if (sourceElement.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!TryGetString(sourceElement, "sourceId", out var sourceId)
            || !TryGetString(sourceElement, "url", out var url)
            || !TryGetString(sourceElement, "title", out var title)
            || !TryGetString(sourceElement, "publisher", out var publisher)
            || !TryGetString(sourceElement, "claimedSourceType", out var claimedSourceType)
            || !sourceElement.TryGetProperty("claimedCanonicalWebsite", out var canonicalElement)
            || canonicalElement.ValueKind != JsonValueKind.True && canonicalElement.ValueKind != JsonValueKind.False)
        {
            return false;
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            || url.Length > _researchOptions.MaxUrlLength
            || title.Length > _researchOptions.MaxTitleLength
            || publisher.Length > _researchOptions.MaxPublisherLength)
        {
            return false;
        }

        var sourceType = Enum.TryParse<ResearchSourceType>(claimedSourceType, ignoreCase: true, out var parsedSourceType)
            ? parsedSourceType
            : ResearchSourceType.ThirdParty;

        DateTimeOffset? publishedAtUtc = null;
        if (sourceElement.TryGetProperty("publishedAtUtc", out var publishedElement)
            && publishedElement.ValueKind == JsonValueKind.String
            && DateTimeOffset.TryParse(publishedElement.GetString(), out var parsedPublishedAt))
        {
            publishedAtUtc = parsedPublishedAt;
        }

        source = new CandidateResearchSource(
            Id: sourceId,
            ClaimedSourceType: sourceType,
            Title: title,
            Publisher: publisher,
            Url: url,
            ClaimedCanonicalProjectWebsite: canonicalElement.GetBoolean(),
            PublishedAtUtc: publishedAtUtc);

        return true;
    }

    private static bool TryParseClaim(
        JsonElement claimElement,
        HashSet<string> sourceIds,
        out CandidateDocumentedClaim? claim)
    {
        claim = null;
        if (claimElement.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!TryGetString(claimElement, "claimId", out var claimId)
            || !TryGetString(claimElement, "category", out var category)
            || !TryGetString(claimElement, "statement", out var statement)
            || !claimElement.TryGetProperty("sourceIds", out var sourceIdsElement)
            || sourceIdsElement.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        if (!ResearchClaimContract.IsSupportedClaimId(claimId))
        {
            return true;
        }

        if (!ResearchClaimContract.IsClaimCategoryCompatible(claimId, category))
        {
            return false;
        }

        var referencedSourceIds = new List<string>();
        foreach (var sourceIdElement in sourceIdsElement.EnumerateArray())
        {
            if (sourceIdElement.ValueKind != JsonValueKind.String)
            {
                return false;
            }

            var sourceId = sourceIdElement.GetString();
            if (string.IsNullOrWhiteSpace(sourceId) || !sourceIds.Contains(sourceId))
            {
                return false;
            }

            referencedSourceIds.Add(sourceId);
        }

        if (referencedSourceIds.Count == 0)
        {
            return false;
        }

        var observedFacts = new List<ObservedFactReference>();
        if (claimElement.TryGetProperty("observedFactReferences", out var observedFactsElement)
            && observedFactsElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var factElement in observedFactsElement.EnumerateArray())
            {
                if (factElement.ValueKind != JsonValueKind.Object
                    || !TryGetString(factElement, "factId", out var factId))
                {
                    return false;
                }

                if (!AllowedObservedFactIds.Contains(factId))
                {
                    continue;
                }

                observedFacts.Add(new ObservedFactReference(
                    FactId: factId,
                    ObservedValue: TryGetOptionalString(factElement, "observedValue"),
                    ExpectedValue: TryGetOptionalString(factElement, "expectedValue"),
                    Note: TryGetOptionalString(factElement, "note")));
            }
        }

        claim = new CandidateDocumentedClaim(
            Id: claimId,
            Category: category,
            Statement: statement,
            SourceIds: referencedSourceIds
                .Distinct(StringComparer.Ordinal)
                .OrderBy(id => id, StringComparer.Ordinal)
                .ToArray(),
            ObservedFactReferences: observedFacts,
            ExtractionNote: TryGetOptionalString(claimElement, "extractionNote"));

        return true;
    }

    private static bool TryParseEvidence(JsonElement evidenceElement, out CandidateIdentityEvidence? evidence)
    {
        evidence = null;
        if (evidenceElement.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!TryGetString(evidenceElement, "evidenceType", out var evidenceType))
        {
            return false;
        }

        if (!Enum.TryParse<ResearchIdentityEvidenceType>(evidenceType, ignoreCase: true, out var parsedEvidenceType))
        {
            return true;
        }

        evidence = new CandidateIdentityEvidence(
            EvidenceType: parsedEvidenceType,
            Value: TryGetOptionalString(evidenceElement, "value"),
            Note: TryGetOptionalString(evidenceElement, "note"));

        return true;
    }

    private static bool TryGetString(JsonElement element, string propertyName, out string value)
    {
        value = string.Empty;
        if (!element.TryGetProperty(propertyName, out var property)
            || property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = property.GetString() ?? string.Empty;
        return !string.IsNullOrWhiteSpace(value);
    }

    private static string? TryGetOptionalString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property)
            || property.ValueKind is not (JsonValueKind.String or JsonValueKind.Null))
        {
            return null;
        }

        return property.GetString();
    }

    private static bool ContainsForbiddenField(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    if (ForbiddenFieldNames.Contains(property.Name.Replace("_", string.Empty, StringComparison.Ordinal).ToLowerInvariant()))
                    {
                        return true;
                    }

                    if (ContainsForbiddenField(property.Value))
                    {
                        return true;
                    }
                }

                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    if (ContainsForbiddenField(item))
                    {
                        return true;
                    }
                }

                break;
        }

        return false;
    }

    private static GeminiClientResult<T> Fail<T>(GeminiFailureReason reason, string detail)
    {
        return new GeminiClientResult<T>(false, default, reason, detail);
    }
}
