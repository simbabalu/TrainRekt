using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        endpoints.MapGet("/health", () =>
        {
            var response = new HealthStatusResponse(
                Status: "ok",
                Service: "TrainRekt.Api",
                TimestampUtc: DateTimeOffset.UtcNow);

            return Results.Ok(response);
        });

        return endpoints;
    }
}
