using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public interface ITokenInspectionService
{
    Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken);
}
