using TrainRekt.Api.Application.Abstractions;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Services;

public sealed class TokenAccountClassificationService : ITokenAccountClassificationService
{
    private static readonly TokenAccountClassification UnknownClassification = new(
        Classification: TokenAccountClassificationConstants.Unknown,
        Protocol: null,
        Confidence: TokenAccountClassificationConstants.UnknownConfidence,
        Evidence: Array.Empty<TokenAccountClassificationEvidence>());

    private readonly IReadOnlyList<ITokenAccountClassifier> _classifiers;

    public TokenAccountClassificationService(IEnumerable<ITokenAccountClassifier> classifiers)
    {
        _classifiers = classifiers.ToArray();
    }

    public async Task<TokenAccountClassification> ClassifyAsync(
        TokenAccountClassificationContext context,
        CancellationToken cancellationToken)
    {
        foreach (var classifier in _classifiers)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var result = await classifier.TryClassifyAsync(context, cancellationToken);
            if (result is not null)
            {
                return result;
            }
        }

        return UnknownClassification;
    }
}
