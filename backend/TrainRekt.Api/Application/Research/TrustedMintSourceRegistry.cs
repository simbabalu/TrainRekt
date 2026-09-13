using TrainRekt.Api.Domain.Constants;
using TrainRekt.Api.Domain.Utils;
using TrainRekt.Api.Domain.Models;

namespace TrainRekt.Api.Application.Research;

public sealed class TrustedMintSourceRegistry : ITrustedMintSourceRegistry
{
    private readonly Dictionary<string, TrustedMintSourceRegistryEntry> _entries;

    public TrustedMintSourceRegistry()
    {
        _entries = new Dictionary<string, TrustedMintSourceRegistryEntry>(StringComparer.Ordinal)
        {
            [ProtocolConstants.SolanaMobileSkrMint] = new TrustedMintSourceRegistryEntry(
                Mint: ProtocolConstants.SolanaMobileSkrMint,
                Protocol: ProtocolConstants.SolanaMobileSkrProtocolName,
                CanonicalDomains: new[]
                {
                    "docs.solanamobile.com"
                },
                OfficialGithubRepositories: new[]
                {
                    "solana-mobile/react-native-samples"
                },
                TrustedUrlPrefixes: new Dictionary<string, ResearchSourceType>(StringComparer.Ordinal)
                {
                    ["https://docs.solanamobile.com/solana-mobile-stack/skr"] = ResearchSourceType.OfficialDocumentation,
                    ["https://github.com/solana-mobile/react-native-samples/"] = ResearchSourceType.OfficialRepository,
                    ["https://raw.githubusercontent.com/solana-mobile/react-native-samples/"] = ResearchSourceType.OfficialRepository,
                    ["https://raw.githubusercontent.com/solana-mobile/react-native-samples/main/skr-staking/program/idl.json"] = ResearchSourceType.OfficialIdl
                })
        };
    }

    public bool TryGetByMint(string mint, out TrustedMintSourceRegistryEntry entry)
    {
        entry = default!;
        if (!SolanaPublicKeyValidator.TryNormalize(mint, out var normalizedMint))
        {
            return false;
        }

        if (_entries.TryGetValue(normalizedMint, out var found) && found is not null)
        {
            entry = found;
            return true;
        }

        return false;
    }
}
