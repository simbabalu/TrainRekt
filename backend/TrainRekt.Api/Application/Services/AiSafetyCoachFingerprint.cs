using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

internal static class AiSafetyCoachFingerprint
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };

    public static string Compute(AiSafetyCoachInput input)
    {
        var json = JsonSerializer.Serialize(input, SerializerOptions);
        var bytes = Encoding.UTF8.GetBytes(json);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    // Coach cache identity is scoped to deterministic + provenance data only, so the same
    // fingerprint can be validated before external context/Gemini run and reused when persisting.
    public static string ComputeCoachDependencyFingerprint(AiSafetyCoachInput input)
    {
        return Compute(input with { ExternalContext = null });
    }
}