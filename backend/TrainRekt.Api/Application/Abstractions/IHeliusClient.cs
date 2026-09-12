using System.Net.Http;
using System.Text.Json;

namespace TrainRekt.Api.Application.Abstractions;

public interface IHeliusClient
{
    HttpRequestMessage CreateRpcPostRequest(string jsonRpcPayload);

    Task<JsonDocument> SendRpcRequestAsync(string method, IReadOnlyList<object?> parameters, CancellationToken cancellationToken);
}
