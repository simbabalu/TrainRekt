namespace TrainRekt.Api.Domain.Constants;

public static class SolanaTokenConstants
{
    public const string SplTokenProgramId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
    public const string Token2022ProgramId = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
    public const string MetaplexMetadataProgramId = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
    public const int MintAccountBaseLengthBytes = 82;
    public const int Token2022MintPaddingLengthBytes = 83;
    public const int Token2022MintAccountTypeOffset = MintAccountBaseLengthBytes + Token2022MintPaddingLengthBytes;
    public const byte Token2022MintAccountType = 1;
}
