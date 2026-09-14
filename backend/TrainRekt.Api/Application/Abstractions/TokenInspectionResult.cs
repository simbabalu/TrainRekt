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

public sealed record TokenInspectionResult(
    TokenInspection? Inspection,
    TokenInspectionError? Error,
    TokenInspectionResearchStatus? ResearchStatus = null)
{
    public static TokenInspectionResult Success(TokenInspection inspection, TokenInspectionResearchStatus? researchStatus = null) =>
        new(inspection, null, researchStatus);

    public static TokenInspectionResult Failure(TokenInspectionErrorCode code, string message) =>
        new(null, new TokenInspectionError(code, message), null);
}
