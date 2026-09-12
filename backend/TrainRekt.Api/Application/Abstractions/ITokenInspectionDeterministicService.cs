namespace TrainRekt.Api.Application.Abstractions;

public interface ITokenInspectionDeterministicService
{
    Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken);
}
