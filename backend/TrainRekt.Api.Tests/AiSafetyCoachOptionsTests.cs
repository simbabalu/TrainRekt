using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;

namespace TrainRekt.Api.Tests;

public sealed class AiSafetyCoachOptionsTests
{
    [Fact]
    public void Defaults_AreEnglishAndDisabled()
    {
        var options = new AiSafetyCoachOptions();

        Assert.False(options.Enabled);
        Assert.Equal("en", options.Language);
        Assert.Equal(24, options.FreshnessHours);
    }

    [Fact]
    public void AddApiServices_InvalidLanguage_FailsValidation()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Helius:RpcBaseUrl"] = "https://mainnet.helius-rpc.com",
                ["AiSafetyCoach:Language"] = "fr"
            })
            .Build();

        var services = new ServiceCollection();
        services.AddApiServices(configuration);

        using var provider = services.BuildServiceProvider();
        Assert.Throws<OptionsValidationException>(() => provider.GetRequiredService<IOptions<AiSafetyCoachOptions>>().Value);
    }
}