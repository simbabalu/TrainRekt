namespace TrainRekt.Api.Domain.Models;

public sealed record TokenAuthorities(
    string? MintAuthority,
    bool MintAuthorityRevoked,
    string? FreezeAuthority,
    bool FreezeAuthorityRevoked);
