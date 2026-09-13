using Microsoft.AspNetCore.Mvc;
using TrainRekt.Api.Api.Contracts;
using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Api.Endpoints;

public static class TokenInspectionEndpoints
{
    public static IEndpointRouteBuilder MapTokenInspectionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        endpoints.MapPost("/api/token-inspections", HandleInspectionRequestAsync);
        endpoints.MapPost("/api/token-inspections/{mint}/coach", HandleInspectionCoachRequestAsync);
        endpoints.MapPost("/api/token-inspections/{mint}/provenance", HandleInspectionProvenanceRequestAsync);

        return endpoints;
    }

    private static async Task<IResult> HandleInspectionRequestAsync(
        TokenInspectionRequest request,
        ITokenInspectionService tokenInspectionService,
        CancellationToken cancellationToken)
    {
        var result = await tokenInspectionService.InspectAsync(request.Mint, cancellationToken);

        if (result.Error is null && result.Inspection is not null)
        {
            return Results.Ok(TokenInspectionResponse.FromDomain(result.Inspection));
        }

        if (result.Error is null)
        {
            return Results.Problem(
                title: "Inspection failed",
                detail: "Token inspection produced no result.",
                statusCode: StatusCodes.Status502BadGateway);
        }

        return MapInspectionError(result.Error);
    }

    private static async Task<IResult> HandleInspectionCoachRequestAsync(
        string mint,
        ITokenInspectionCoachService coachService,
        CancellationToken cancellationToken)
    {
        var result = await coachService.GenerateAsync(mint, cancellationToken);

        if (result.InspectionError is not null)
        {
            return MapInspectionError(result.InspectionError);
        }

        return Results.Ok(TokenInspectionCoachResponse.FromDomain(result));
    }

    private static async Task<IResult> HandleInspectionProvenanceRequestAsync(
        string mint,
        ITokenIdentityProvenanceService provenanceService,
        CancellationToken cancellationToken)
    {
        var result = await provenanceService.AnalyzeAsync(mint, cancellationToken);

        if (result.InspectionError is not null)
        {
            return MapInspectionError(result.InspectionError);
        }

        if (result.Provenance is null)
        {
            return Results.Problem(
                title: "Provenance analysis failed",
                detail: "Token identity provenance produced no result.",
                statusCode: StatusCodes.Status502BadGateway);
        }

        return Results.Ok(TokenIdentityProvenanceResponse.FromDomain(result.Provenance));
    }

    private static IResult MapInspectionError(TokenInspectionError error)
    {
        return error.Code switch
        {
            TokenInspectionErrorCode.InvalidMint => Results.BadRequest(CreateProblem(
                title: "Invalid mint",
                detail: error.Message,
                statusCode: StatusCodes.Status400BadRequest)),
            TokenInspectionErrorCode.MintNotFound => Results.NotFound(CreateProblem(
                title: "Mint not found",
                detail: error.Message,
                statusCode: StatusCodes.Status404NotFound)),
            TokenInspectionErrorCode.NotFungibleTokenMint => Results.UnprocessableEntity(CreateProblem(
                title: "Unsupported account type",
                detail: error.Message,
                statusCode: StatusCodes.Status422UnprocessableEntity)),
            TokenInspectionErrorCode.ProviderUnavailable => Results.Problem(
                title: "Provider unavailable",
                detail: error.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable),
            TokenInspectionErrorCode.ProviderRejectedRequest => Results.Problem(
                title: "Provider rejected request",
                detail: error.Message,
                statusCode: StatusCodes.Status502BadGateway),
            TokenInspectionErrorCode.ProviderMalformedResponse => Results.Problem(
                title: "Provider response invalid",
                detail: error.Message,
                statusCode: StatusCodes.Status502BadGateway),
            TokenInspectionErrorCode.PersistenceUnavailable => Results.Problem(
                title: "Persistence unavailable",
                detail: error.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable),
            TokenInspectionErrorCode.Cancelled => Results.Problem(
                title: "Request cancelled",
                detail: error.Message,
                statusCode: 499),
            _ => Results.Problem(
                title: "Inspection failed",
                detail: "Token inspection failed unexpectedly.",
                statusCode: StatusCodes.Status502BadGateway)
        };
    }

    private static ProblemDetails CreateProblem(string title, string detail, int statusCode)
    {
        return new ProblemDetails
        {
            Title = title,
            Detail = detail,
            Status = statusCode
        };
    }
}
