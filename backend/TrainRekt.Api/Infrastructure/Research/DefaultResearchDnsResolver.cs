using System.Net;
using TrainRekt.Api.Application.Research;

namespace TrainRekt.Api.Infrastructure.Research;

public sealed class DefaultResearchDnsResolver : IResearchDnsResolver
{
    public async Task<IReadOnlyList<IPAddress>> ResolveAsync(string host, CancellationToken cancellationToken)
    {
        // DNS resolution is intentionally explicit to support deterministic security testing.
        var addresses = await Dns.GetHostAddressesAsync(host, cancellationToken);
        return addresses;
    }
}
