using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public sealed class ResearchRequestFactory
{
    public ResearchRequest Create(TokenInspection inspection, IReadOnlyList<ResearchNeed> needs)
    {
        var classifiedProtocols = inspection.LargestTokenAccounts
            .Where(account => !string.IsNullOrWhiteSpace(account.Classification.Protocol))
            .Select(account => account.Classification.Protocol!)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(protocol => protocol, StringComparer.Ordinal)
            .ToArray();

        var existingSourceIds = inspection.ProtocolContext?.Sources
            .Select(source => source.Id)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToArray()
            ?? Array.Empty<string>();

        var existingClaimIds = inspection.ProtocolContext?.Claims
            .Select(claim => claim.Id)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToArray()
            ?? Array.Empty<string>();

        return new ResearchRequest(
            Mint: inspection.Identity.Mint,
            TokenName: inspection.Identity.Name,
            TokenSymbol: inspection.Identity.Symbol,
            TokenProgram: inspection.Identity.ProgramId,
            Authorities: inspection.Authorities,
            ClassifiedProtocols: classifiedProtocols,
            Needs: needs,
            ExistingSourceIds: existingSourceIds,
            ExistingClaimIds: existingClaimIds);
    }
}
