namespace TrainRekt.Api.Application.Abstractions;

public enum HeliusRpcFailureKind
{
    Transport,
    RateLimited,
    ProviderError,
    MalformedResponse
}

public sealed class HeliusRpcException : Exception
{
    public HeliusRpcException(
        HeliusRpcFailureKind kind,
        string message,
        int? providerErrorCode = null,
        string? providerErrorMessage = null,
        Exception? innerException = null)
        : base(message, innerException)
    {
        Kind = kind;
        ProviderErrorCode = providerErrorCode;
        ProviderErrorMessage = providerErrorMessage;
    }

    public HeliusRpcFailureKind Kind { get; }

    public int? ProviderErrorCode { get; }

    public string? ProviderErrorMessage { get; }
}
