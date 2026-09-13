using System.Text.Json;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Research;

namespace TrainRekt.Api.Tests;

public sealed class ResearchRequestPrivacyTests
{
    [Fact]
    public void CreateRequest_SerializedPayload_DoesNotContainWalletOrUserSensitiveFields()
    {
        var inspection = ResearchTestData.CreateInspection(mintAuthorityRevoked: false, freezeAuthorityRevoked: false, largestUnknownTokenAccountPercentage: 12m);
        var options = new TokenResearchOptions();
        var needs = new ResearchNeedDetector(options).Detect(inspection);

        var request = new ResearchRequestFactory().Create(inspection, needs);
        var serialized = JsonSerializer.Serialize(request).ToLowerInvariant();

        Assert.DoesNotContain("wallet", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("device", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("balance", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("holding", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("mwa", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("seed", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("privatekey", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("helius_api_key", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("gemini_api_key", serialized, StringComparison.Ordinal);
    }
}
