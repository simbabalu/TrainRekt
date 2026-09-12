namespace TrainRekt.Api.Domain.Models;

public sealed record TokenIssuanceProtocolContext(
    string Classification,
    string Verification,
    IReadOnlyList<string> SourceIds,
    bool MintAuthorityStateConsistentWithDocumentedModel,
    bool MintAuthorityIdentityVerified,
    string? MintAuthorityIdentityVerificationNote);

public sealed record TokenProtocolContext(
    string Protocol,
    TokenIssuanceProtocolContext? Issuance);
