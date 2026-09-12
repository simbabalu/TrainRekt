using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Application.Services;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TokenAccountClassificationServiceTests
{
    private sealed class NullClassifier : ITokenAccountClassifier
    {
        public ValueTask<TokenAccountClassification?> TryClassifyAsync(
            TokenAccountClassificationContext context,
            CancellationToken cancellationToken)
        {
            return ValueTask.FromResult<TokenAccountClassification?>(null);
        }
    }

    private sealed class FixedClassifier : ITokenAccountClassifier
    {
        private readonly TokenAccountClassification _classification;

        public FixedClassifier(TokenAccountClassification classification)
        {
            _classification = classification;
        }

        public ValueTask<TokenAccountClassification?> TryClassifyAsync(
            TokenAccountClassificationContext context,
            CancellationToken cancellationToken)
        {
            return ValueTask.FromResult<TokenAccountClassification?>(_classification);
        }
    }

    [Fact]
    public async Task ClassifyAsync_ReturnsFirstMatchingClassifier()
    {
        var expected = new TokenAccountClassification(
            Classification: TokenAccountClassificationConstants.BondingCurve,
            Protocol: ProtocolConstants.PumpFunProtocolName,
            Confidence: TokenAccountClassificationConstants.Verified,
            Evidence: Array.Empty<TokenAccountClassificationEvidence>());

        var service = new TokenAccountClassificationService(new ITokenAccountClassifier[]
        {
            new NullClassifier(),
            new FixedClassifier(expected)
        });

        var result = await service.ClassifyAsync(CreateContext(), CancellationToken.None);

        Assert.Equal(expected, result);
    }

    [Fact]
    public async Task ClassifyAsync_NoClassifierMatches_ReturnsUnknown()
    {
        var service = new TokenAccountClassificationService(new ITokenAccountClassifier[]
        {
            new NullClassifier()
        });

        var result = await service.ClassifyAsync(CreateContext(), CancellationToken.None);

        Assert.Equal(TokenAccountClassificationConstants.Unknown, result.Classification);
        Assert.Equal(TokenAccountClassificationConstants.UnknownConfidence, result.Confidence);
        Assert.Null(result.Protocol);
        Assert.Empty(result.Evidence);
    }

    private static TokenAccountClassificationContext CreateContext()
    {
        return new TokenAccountClassificationContext(
            Request: new TokenAccountClassificationRequestContext(
                Mint: "So11111111111111111111111111111111111111112",
                MintProgramId: SolanaTokenConstants.SplTokenProgramId,
                PumpFun: null),
            TokenAccountAddress: "token-account",
            TokenAccountMint: null,
            TokenAccountAuthority: null,
            TokenAccountProgramId: null,
            TokenAccountAmountRaw: 10,
            PercentageOfSupply: 1m);
    }
}
