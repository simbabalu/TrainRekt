using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TrustedSourceClassifierTests
{
    [Fact]
    public void Classify_ExactTrustedIdlPath_IsOfficialIdl()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://raw.githubusercontent.com/solana-mobile/react-native-samples/main/skr-staking/program/idl.json");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.True(decision.IsTrusted);
        Assert.Equal(ResearchSourceType.OfficialIdl, decision.EffectiveType);
    }

    [Fact]
    public void Classify_IdlPrefixSpoof_IsNotOfficialIdl()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://raw.githubusercontent.com/solana-mobile/react-native-samples/main/skr-staking/program/idl.json.evil");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.True(decision.IsTrusted);
        Assert.NotEqual(ResearchSourceType.OfficialIdl, decision.EffectiveType);
    }

    [Fact]
    public void Classify_PathPrefixSpoof_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://raw.githubusercontent.com/solana-mobile/react-native-samples-malicious/main/skr-staking/program/idl.json");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.False(decision.IsTrusted);
        Assert.Null(decision.EffectiveType);
    }

    [Fact]
    public void Classify_HostSpoof_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://raw.githubusercontent.com.evil/solana-mobile/react-native-samples/main/skr-staking/program/idl.json");
        var decision = classifier.Classify(entry, uri, "raw.githubusercontent.com.evil");

        Assert.False(decision.IsTrusted);
    }

    [Fact]
    public void Classify_EncodedPathSeparatorSpoof_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://raw.githubusercontent.com/solana-mobile/react-native-samples%2Fmalicious/main/skr-staking/program/idl.json");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.False(decision.IsTrusted);
        Assert.Null(decision.EffectiveType);
    }
}
