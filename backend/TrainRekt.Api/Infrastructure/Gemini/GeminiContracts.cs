using TrainRekt.Api.Application.Research;

namespace TrainRekt.Api.Infrastructure.Gemini;

public sealed record GeminiCitation(string Url, string? Title);

public sealed record GeminiGroundedResearch(string Text, IReadOnlyList<GeminiCitation> Sources);

public sealed record GeminiClientResult<T>(
    bool Success,
    T? Value,
    GeminiFailureReason? FailureReason,
    string? Detail,
    int? HttpStatusCode = null);

public interface IGeminiInteractionClient
{
    Task<GeminiClientResult<GeminiGroundedResearch>> RunGroundedResearchAsync(ResearchRequest request, CancellationToken cancellationToken);

    Task<GeminiClientResult<string>> RunStructuredExtractionAsync(
        ResearchRequest request,
        GeminiGroundedResearch groundedResearch,
        CancellationToken cancellationToken);
}
