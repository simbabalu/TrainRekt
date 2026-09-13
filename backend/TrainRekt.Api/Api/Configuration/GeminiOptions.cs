namespace TrainRekt.Api.Api.Configuration;

public sealed class GeminiOptions
{
    public const string SectionName = "Gemini";

    public bool Enabled { get; set; }

    public string? ApiKey { get; set; }

    public string Model { get; set; } = "gemini-2.5-flash-lite";

    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com";

    public int TimeoutSeconds { get; set; } = 15;

    public int MaxResearchOutputTokens { get; set; } = 1200;

    public int MaxExtractionOutputTokens { get; set; } = 1800;

    public bool EnableGoogleSearch { get; set; } = true;

    public int MaxResponseBytes { get; set; } = 524288;
}
