namespace TrainRekt.Api.Api.Configuration;

public sealed class HeliusOptions
{
    public const string SectionName = "Helius";

    public string? ApiKey { get; set; }

    public string RpcBaseUrl { get; set; } = "https://mainnet.helius-rpc.com";
}
