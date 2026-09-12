using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;

namespace TrainRekt.Api.Tests;

public class HeliusOptionsTests
{
    private static readonly object EnvironmentVariableLock = new();

    [Fact]
    public void AddApiServices_BindsApiKeyFromHeliusApiKeyEnvironmentVariable()
    {
        lock (EnvironmentVariableLock)
        {
            const string variableName = "HELIUS_API_KEY";
            const string expectedApiKey = "test-helius-key";
            var previousValue = Environment.GetEnvironmentVariable(variableName);

            try
            {
                Environment.SetEnvironmentVariable(variableName, expectedApiKey);

                var inMemorySettings = new Dictionary<string, string?>
                {
                    [$"{HeliusOptions.SectionName}:RpcBaseUrl"] = "https://mainnet.helius-rpc.com"
                };

                var configuration = new ConfigurationBuilder()
                    .AddInMemoryCollection(inMemorySettings)
                    .AddEnvironmentVariables()
                    .Build();

                var services = new ServiceCollection();
                services.AddApiServices(configuration);

                using var serviceProvider = services.BuildServiceProvider();
                var options = serviceProvider.GetRequiredService<IOptions<HeliusOptions>>().Value;

                Assert.Equal(expectedApiKey, options.ApiKey);
                Assert.Equal("https://mainnet.helius-rpc.com", options.RpcBaseUrl);
            }
            finally
            {
                Environment.SetEnvironmentVariable(variableName, previousValue);
            }
        }
    }
}
