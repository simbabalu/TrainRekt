using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

internal static class AiSafetyCoachFingerprint
{
    private const string MintScopedFingerprintVersion = "coach-mint-scope-v1";

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

    public static string ComputeMintScoped(string normalizedMint)
    {
        var payload = $"{MintScopedFingerprintVersion}:{normalizedMint}";
        var bytes = Encoding.UTF8.GetBytes(payload);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}