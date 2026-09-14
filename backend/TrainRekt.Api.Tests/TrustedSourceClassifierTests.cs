using TrainRekt.Api.Application.Research;
using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Tests;

public sealed class TrustedSourceClassifierTests
{
    private const string JupiterMint = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

    [Fact]
    public void Classify_ExactSkrWebsitePath_IsTrustedProjectWebsite()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://solanamobile.com/skr");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.True(decision.IsTrusted);
        Assert.Equal(ResearchSourceType.ProjectWebsite, decision.EffectiveType);
        Assert.True(decision.IsCanonicalProjectWebsite);
    }

    [Fact]
    public void Classify_SkrWebsitePathSuffixSpoof_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://solanamobile.com/skr-evil");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.False(decision.IsTrusted);
        Assert.Null(decision.EffectiveType);
    }

    [Fact]
    public void Classify_SkrWebsiteHostSpoof_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://solanamobile.com.evil.example/skr");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.False(decision.IsTrusted);
        Assert.Null(decision.EffectiveType);
    }

    [Fact]
    public void Classify_SkrWebsitePathOnUntrustedHost_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://evil.example/solanamobile.com/skr");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.False(decision.IsTrusted);
        Assert.Null(decision.EffectiveType);
    }

    [Fact]
    public void Classify_SkrWebsiteEncodedPathSpoof_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var registry = new TrustedMintSourceRegistry();
        var found = registry.TryGetByMint(ProtocolConstants.SolanaMobileSkrMint, out var entry);

        Assert.True(found);

        var uri = new Uri("https://solanamobile.com/%2f../skr");
        var decision = classifier.Classify(entry, uri, uri.Host);

        Assert.False(decision.IsTrusted);
        Assert.Null(decision.EffectiveType);
    }

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

    [Fact]
    public void Classify_JupiterLookalikeDomain_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var policies = new TrustedProjectSourcePolicyRegistry();
        var policy = policies.List().Single(entry => entry.ProjectKey == "jupiter");

        var uri = new Uri("https://jup.ag.evil.example/token");
        var decision = classifier.Classify(null, policy, uri, uri.Host);

        Assert.False(decision.IsTrusted);
        Assert.Null(decision.EffectiveType);
    }

    [Fact]
    public void Classify_OfficialJupiterDomain_IsTrusted()
    {
        var classifier = new TrustedSourceClassifier();
        var policies = new TrustedProjectSourcePolicyRegistry();
        var policy = policies.List().Single(entry => entry.ProjectKey == "jupiter");

        var uri = new Uri("https://station.jup.ag/guides/token-list");
        var decision = classifier.Classify(null, policy, uri, uri.Host);

        Assert.True(decision.IsTrusted);
        Assert.Equal(ResearchSourceType.OfficialDocumentation, decision.EffectiveType);
    }

    [Fact]
    public void Classify_ArbitraryGithubRepositoryContainingJupMint_IsRejected()
    {
        var classifier = new TrustedSourceClassifier();
        var policies = new TrustedProjectSourcePolicyRegistry();
        var policy = policies.List().Single(entry => entry.ProjectKey == "jupiter");

        var uri = new Uri($"https://github.com/not-jup-org/fake-repo/blob/main/README.md#{JupiterMint}");
        var decision = classifier.Classify(null, policy, uri, uri.Host);

        Assert.False(decision.IsTrusted);
        Assert.Null(decision.EffectiveType);
    }
}
