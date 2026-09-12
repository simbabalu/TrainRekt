namespace TrainRekt.Api.Domain.Constants;

public static class ProtocolConstants
{
    public const string PumpFunProtocolName = "pump.fun";
    public const string PumpFunProgramId = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
    public const string PumpFunBondingCurveSeed = "bonding-curve";

    public const string PumpSwapProtocolName = "pumpswap";
    public const string PumpSwapProgramId = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
    public const string PumpSwapPoolSeed = "pool";

    public const string SolanaMobileSkrProtocolName = "solana-mobile-skr";

    // Official SKR references:
    // - https://docs.solanamobile.com/solana-mobile-stack/skr.md
    // - https://github.com/solana-mobile/react-native-samples/tree/main/skr-staking
    // - https://raw.githubusercontent.com/solana-mobile/react-native-samples/main/skr-staking/program/idl.json
    public const string SolanaMobileSkrMint = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
    public const string SolanaMobileSkrStakingProgramId = "SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ";
    public const string SolanaMobileSkrStakeConfigAddress = "4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw";
    public const string SolanaMobileSkrStakeVaultAddress = "8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8";
    public const string SolanaMobileSkrGuardianPoolAddress = "DPJ58trLsF9yPrBa2pk6UaRkvqW8hWUYjawe788WBuqr";
    public const string SolanaMobileSkrStakeConfigSeed = "stake_config";
    public const string SolanaMobileSkrStakeVaultSeed = "stake_vault";

    public const string SolanaMobileSkrTokenomicsSourceId = "solana-mobile-skr-tokenomics";
    public const string SolanaMobileSkrStakingIdlSourceId = "solana-mobile-skr-staking-idl";
}
