using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;

namespace TrainRekt.Api.Tests;

public sealed class GeminiOptionsTests
{
    private static readonly object EnvironmentVariableLock = new();

    [Fact]
    public void AddApiServices_BindsGeminiApiKeyFromEnvironmentVariable()
    {
        lock (EnvironmentVariableLock)
        {
            const string variableName = "GEMINI_API_KEY";
            const string expectedApiKey = "test-gemini-key";
            var previousValue = Environment.GetEnvironmentVariable(variableName);

            try
            {
                Environment.SetEnvironmentVariable(variableName, expectedApiKey);

                var settings = new Dictionary<string, string?>
                {
                    [$"{GeminiOptions.SectionName}:Enabled"] = "true",
                    [$"{GeminiOptions.SectionName}:Model"] = "gemini-2.5-flash-lite",
                    [$"{GeminiOptions.SectionName}:BaseUrl"] = "https://generativelanguage.googleapis.com",
                    [$"{GeminiOptions.SectionName}:TimeoutSeconds"] = "15"
                };

                var configuration = new ConfigurationBuilder()
                    .AddInMemoryCollection(settings)
                    .AddEnvironmentVariables()
                    .Build();

                var services = new ServiceCollection();
                services.AddApiServices(configuration);

                using var provider = services.BuildServiceProvider();
                var options = provider.GetRequiredService<IOptions<GeminiOptions>>().Value;

                Assert.Equal(expectedApiKey, options.ApiKey);
                Assert.True(options.Enabled);
            }
            finally
            {
                Environment.SetEnvironmentVariable(variableName, previousValue);
            }
        }
    }

    [Fact]
    public void GeminiOptions_Defaults_DisabledAndNoApiKey()
    {
        var options = new GeminiOptions();

        Assert.False(options.Enabled);
        Assert.Null(options.ApiKey);
        Assert.Equal("gemini-2.5-flash-lite", options.Model);
    }
}
