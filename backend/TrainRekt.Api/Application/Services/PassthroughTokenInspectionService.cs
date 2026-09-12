using TrainRekt.Api.Application.Abstractions;

namespace TrainRekt.Api.Application.Services;

public sealed class PassthroughTokenInspectionService : ITokenInspectionService
{
    private readonly ITokenInspectionDeterministicService _deterministicService;

    public PassthroughTokenInspectionService(ITokenInspectionDeterministicService deterministicService)
    {
        _deterministicService = deterministicService;
    }

    public Task<TokenInspectionResult> InspectAsync(string mint, CancellationToken cancellationToken)
    {
        return _deterministicService.InspectAsync(mint, cancellationToken);
    }
}
