using System.Net;
using Microsoft.Extensions.Options;
using TrainRekt.Api.Api.Configuration;
using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Infrastructure.Helius;

namespace TrainRekt.Api.Tests;

public sealed class HeliusClientSecurityAndErrorTests
{
    [Fact]
    public async Task SendRpcRequestAsync_WithJsonRpcErrorInHttp200_ThrowsProviderErrorNotTransport()
    {
        const string apiKey = "test-secret-key";
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32602,\"message\":\"Invalid params\"},\"id\":\"1\"}")
        });

        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://mainnet.helius-rpc.com")
        };

        var client = new HeliusClient(httpClient, Options.Create(new HeliusOptions
        {
            ApiKey = apiKey,
            RpcBaseUrl = "https://mainnet.helius-rpc.com"
        }));

        var exception = await Assert.ThrowsAsync<HeliusRpcException>(() =>
            client.SendRpcRequestAsync("getTokenLargestAccounts", ["mint"], CancellationToken.None));

        Assert.Equal(HeliusRpcFailureKind.ProviderError, exception.Kind);
        Assert.Equal(-32602, exception.ProviderErrorCode);
        Assert.DoesNotContain(apiKey, exception.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("api-key=", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SendRpcRequestAsync_WithRateLimitJsonRpcError_ThrowsRateLimited()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"jsonrpc\":\"2.0\",\"error\":{\"code\":429,\"message\":\"rate limit exceeded\"},\"id\":\"1\"}")
        });

        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://mainnet.helius-rpc.com")
        };

        var client = new HeliusClient(httpClient, Options.Create(new HeliusOptions
        {
            ApiKey = "test-secret-key",
            RpcBaseUrl = "https://mainnet.helius-rpc.com"
        }));

        var exception = await Assert.ThrowsAsync<HeliusRpcException>(() =>
            client.SendRpcRequestAsync("getAccountInfo", ["mint"], CancellationToken.None));

        Assert.Equal(HeliusRpcFailureKind.RateLimited, exception.Kind);
    }

    [Fact]
    public async Task SendRpcRequestAsync_WhenApiKeyMissing_DoesNotLeakUriOrSecret()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"jsonrpc\":\"2.0\",\"result\":{},\"id\":\"1\"}")
        });

        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://mainnet.helius-rpc.com")
        };

        var client = new HeliusClient(httpClient, Options.Create(new HeliusOptions
        {
            ApiKey = null,
            RpcBaseUrl = "https://mainnet.helius-rpc.com"
        }));

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            client.SendRpcRequestAsync("getAccountInfo", ["mint"], CancellationToken.None));

        Assert.DoesNotContain("api-key=", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("https://", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responseFactory;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        {
            _responseFactory = responseFactory;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_responseFactory(request));
        }
    }
}
