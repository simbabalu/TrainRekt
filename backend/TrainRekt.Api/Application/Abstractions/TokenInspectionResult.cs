using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public enum TokenInspectionErrorCode
{
    InvalidMint,
    MintNotFound,
    NotFungibleTokenMint,
    ProviderUnavailable,
    ProviderRejectedRequest,
    ProviderMalformedResponse,
    PersistenceUnavailable,
    Cancelled
}

public sealed record TokenInspectionError(TokenInspectionErrorCode Code, string Message);

public sealed record TokenInspectionResult(TokenInspection? Inspection, TokenInspectionError? Error)
{
    public static TokenInspectionResult Success(TokenInspection inspection) => new(inspection, null);

    public static TokenInspectionResult Failure(TokenInspectionErrorCode code, string message) =>
        new(null, new TokenInspectionError(code, message));
}
