using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Abstractions;

public enum TokenExternalContextAvailability
{
    Available,
    Unavailable,
    Disabled
}

public enum TokenExternalContextFailureReason
{
    Timeout,
    ProviderUnavailable,
    NetworkFailure,
    NoRelevantEvidence,
    AmbiguousEvidence,
    Disabled,
    MissingApiKey,
    InvalidResponse,
    Unknown
}

public enum TokenExternalAssetType
{
    Unknown,
    TokenizedStock,
    Rwa,
    Stablecoin,
    WrappedAsset,
    LiquidStakingToken,
    GovernanceToken,
    ProtocolToken,
    MemeToken,
    Other
}

public enum TokenExternalContextSourceType
{
    OfficialProjectWebsite,
    OfficialDocumentation,
    OfficialIssuerDocumentation,
    OfficialRepository,
    ReputableExplorerOrIndexer,
    StructuredTokenDirectory,
    Other
}

public sealed record TokenExternalContextEvidence(
    TokenExternalContextSourceType SourceType,
    string Title,
    string Domain,
    string Claim,
    string? Url);

public sealed record TokenExternalContext(
    TokenExternalContextAvailability Availability,
    TokenExternalAssetType AssetType,
    string? ProjectName,
    string? Summary,
    string Confidence,
    bool MintConfirmed,
    bool AmbiguousIdentity,
    IReadOnlyList<TokenExternalContextEvidence> Evidence,
    TokenExternalContextFailureReason? FailureReason = null);

public sealed record TokenExternalContextKnownSource(
    string Url,
    TokenExternalContextSourceType SourceType,
    string? Publisher);

public sealed record TokenExternalContextRequest(
    string Mint,
    string? TokenName,
    string? TokenSymbol,
    string TokenProgram,
    TokenAuthorities Authorities,
    IReadOnlyList<TokenExternalContextKnownSource> KnownOfficialSources);

public interface ITokenExternalContextProvider
{
    Task<TokenExternalContext> ResearchAsync(TokenExternalContextRequest request, CancellationToken cancellationToken);
}

public interface ITokenExternalContextResearchService
{
    Task<TokenExternalContext> GetContextAsync(
        TokenInspection inspection,
        TokenIdentityProvenance? provenance,
        CancellationToken cancellationToken);
}
