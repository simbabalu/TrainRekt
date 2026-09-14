using System.Diagnostics;
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
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger("TokenInspectionEndpoint");
        var stopwatch = Stopwatch.StartNew();

        var result = await tokenInspectionService.InspectAsync(request.Mint, cancellationToken);

        if (result.Error is null && result.Inspection is not null)
        {
            logger.LogInformation(
                "Token analysis endpoint timing for mint {Mint}: totalMs={TotalMs} endpoint=/api/token-inspections outcome=ok.",
                request.Mint,
                ElapsedMilliseconds(stopwatch));
            return Results.Ok(TokenInspectionResponse.FromDomain(result.Inspection, result.ResearchStatus));
        }

        if (result.Error is null)
        {
            logger.LogInformation(
                "Token analysis endpoint timing for mint {Mint}: totalMs={TotalMs} endpoint=/api/token-inspections outcome=empty-result.",
                request.Mint,
                ElapsedMilliseconds(stopwatch));
            return Results.Problem(
                title: "Inspection failed",
                detail: "Token inspection produced no result.",
                statusCode: StatusCodes.Status502BadGateway);
        }

        logger.LogInformation(
            "Token analysis endpoint timing for mint {Mint}: totalMs={TotalMs} endpoint=/api/token-inspections outcome=error errorCode={ErrorCode}.",
            request.Mint,
            ElapsedMilliseconds(stopwatch),
            result.Error.Code);

        return MapInspectionError(result.Error);
    }

    private static async Task<IResult> HandleInspectionCoachRequestAsync(
        string mint,
        ITokenInspectionCoachService coachService,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger("TokenInspectionCoachEndpoint");
        var stopwatch = Stopwatch.StartNew();

        var result = await coachService.GenerateAsync(mint, cancellationToken);

        if (result.InspectionError is not null)
        {
            logger.LogInformation(
                "Token coach endpoint timing for mint {Mint}: totalMs={TotalMs} endpoint=/api/token-inspections/<mint>/coach outcome=inspection-error errorCode={ErrorCode}.",
                mint,
                ElapsedMilliseconds(stopwatch),
                result.InspectionError.Code);
            return MapInspectionError(result.InspectionError);
        }

        logger.LogInformation(
            "Token coach endpoint timing for mint {Mint}: totalMs={TotalMs} endpoint=/api/token-inspections/<mint>/coach outcome=ok coachStatus={CoachStatus}.",
            mint,
            ElapsedMilliseconds(stopwatch),
            result.Status);

        return Results.Ok(TokenInspectionCoachResponse.FromDomain(result));
    }

    private static async Task<IResult> HandleInspectionProvenanceRequestAsync(
        string mint,
        ITokenIdentityProvenanceService provenanceService,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger("TokenInspectionProvenanceEndpoint");
        var stopwatch = Stopwatch.StartNew();

        var result = await provenanceService.AnalyzeAsync(mint, cancellationToken);

        if (result.InspectionError is not null)
        {
            logger.LogInformation(
                "Token provenance endpoint timing for mint {Mint}: totalMs={TotalMs} endpoint=/api/token-inspections/<mint>/provenance outcome=inspection-error errorCode={ErrorCode}.",
                mint,
                ElapsedMilliseconds(stopwatch),
                result.InspectionError.Code);
            return MapInspectionError(result.InspectionError);
        }

        if (result.Provenance is null)
        {
            logger.LogInformation(
                "Token provenance endpoint timing for mint {Mint}: totalMs={TotalMs} endpoint=/api/token-inspections/<mint>/provenance outcome=empty-result.",
                mint,
                ElapsedMilliseconds(stopwatch));
            return Results.Problem(
                title: "Provenance analysis failed",
                detail: "Token identity provenance produced no result.",
                statusCode: StatusCodes.Status502BadGateway);
        }

        logger.LogInformation(
            "Token provenance endpoint timing for mint {Mint}: totalMs={TotalMs} endpoint=/api/token-inspections/<mint>/provenance outcome=ok.",
            mint,
            ElapsedMilliseconds(stopwatch));

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

    private static long ElapsedMilliseconds(Stopwatch stopwatch)
    {
        return (long)Math.Round(stopwatch.Elapsed.TotalMilliseconds, MidpointRounding.AwayFromZero);
    }
}
