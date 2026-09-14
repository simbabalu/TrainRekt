namespace TrainRekt.Api.Application.Abstractions;

// Core inspection path: deterministic facts with configured cache semantics, excluding optional research enrichment.
public interface ITokenInspectionCoreService
{
    Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken);
}
