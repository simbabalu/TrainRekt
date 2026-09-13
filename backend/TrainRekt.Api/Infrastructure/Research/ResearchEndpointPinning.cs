using System.Net;
using System.Net.Sockets;
using System.Net.Http;

namespace TrainRekt.Api.Infrastructure.Research;

public sealed record ResearchPinnedEndpoint(
    string Host,
    int Port,
    IReadOnlyList<IPAddress> AllowedAddresses);

public static class ResearchEndpointPinning
{
    public static readonly HttpRequestOptionsKey<ResearchPinnedEndpoint> RequestOptionKey =
        new("TrainRekt.Research.PinnedEndpoint");

    public static async ValueTask<Stream> ConnectAsync(
        SocketsHttpConnectionContext context,
        CancellationToken cancellationToken)
    {
        if (!context.InitialRequestMessage.Options.TryGetValue(RequestOptionKey, out var pinning)
            || pinning is null)
        {
            throw new HttpRequestException("Missing endpoint pinning metadata for research request.");
        }

        if (!string.Equals(context.DnsEndPoint.Host, pinning.Host, StringComparison.OrdinalIgnoreCase)
            || context.DnsEndPoint.Port != pinning.Port)
        {
            throw new HttpRequestException("Endpoint pinning mismatch for research request.");
        }

        var exceptions = new List<Exception>();

        foreach (var address in pinning.AllowedAddresses)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp)
            {
                NoDelay = true
            };

            try
            {
                await socket.ConnectAsync(new IPEndPoint(address, pinning.Port), cancellationToken);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch (SocketException ex)
            {
                socket.Dispose();
                exceptions.Add(ex);
            }
            catch (ObjectDisposedException ex)
            {
                socket.Dispose();
                exceptions.Add(ex);
            }
            catch (InvalidOperationException ex)
            {
                socket.Dispose();
                exceptions.Add(ex);
            }
        }

        throw new HttpRequestException("Unable to connect to any validated research endpoint address.", new AggregateException(exceptions));
    }
}
