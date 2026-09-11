import type { WalletMintInspection, WalletSafetySignal, WalletSafetySignalKind, WalletTokenAccountInspection } from '@/types/walletInspection';

interface WalletSafetySignalDefinition {
  kind: WalletSafetySignalKind;
  category: WalletSafetySignal['category'];
  title: string;
  educationalText: string;
  matches: (account: WalletTokenAccountInspection, mintInspection: WalletMintInspection | null) => boolean;
}

const SIGNAL_DEFINITIONS: readonly WalletSafetySignalDefinition[] = [
  {
    kind: 'frozen-account',
    category: 'review',
    title: 'Frozen account',
    educationalText:
      'This token account is currently frozen. A frozen account cannot transfer tokens until the relevant authority allows it. This is a capability/state signal, not proof a token is malicious.',
    matches: (account) => account.state === 'frozen',
  },
  {
    kind: 'delegated-account',
    category: 'review',
    title: 'Delegated account',
    educationalText:
      'Another address has delegated authority over tokens in this account. Review whether you expect that permission. Delegation alone does not prove malicious behavior.',
    matches: (account) => Boolean(account.delegateAddress),
  },
  {
    kind: 'token-2022-account',
    category: 'informational',
    title: 'Token-2022',
    educationalText:
      "This asset uses Solana's Token-2022 program, which supports additional token features. Token-2022 itself is not a warning.",
    matches: (account, mintInspection) => account.program === 'token-2022' || mintInspection?.program === 'token-2022',
  },
  {
    kind: 'empty-token-account',
    category: 'informational',
    title: 'Empty token account',
    educationalText:
      'This account currently contains no tokens. Empty token accounts can remain on-chain and are not inherently suspicious.',
    matches: (account) => account.rawAmount === '0',
  },
  {
    kind: 'mint-authority-active',
    category: 'review',
    title: 'Mint authority active',
    educationalText:
      'This mint currently has an active mint authority, so additional supply may be minted. This capability requires context and does not prove a scam.',
    matches: (_account, mintInspection) => mintInspection?.mintAuthorityState === 'active',
  },
  {
    kind: 'freeze-authority-active',
    category: 'review',
    title: 'Freeze authority active',
    educationalText:
      'This mint currently has an active freeze authority, which may freeze token accounts under that mint. This capability is not automatic proof of malicious behavior.',
    matches: (_account, mintInspection) => mintInspection?.freezeAuthorityState === 'active',
  },
  {
    kind: 'token-2022-permanent-delegate',
    category: 'review',
    title: 'Token-2022 permanent delegate',
    educationalText:
      'This mint has the Token-2022 Permanent Delegate extension. A configured authority may have special transfer or burn powers under extension rules. Presence alone does not prove abuse.',
    matches: (_account, mintInspection) => Boolean(mintInspection?.token2022Extensions.includes('permanent-delegate')),
  },
  {
    kind: 'token-2022-transfer-fee-config',
    category: 'informational',
    title: 'Token-2022 transfer fee',
    educationalText:
      'This mint has a Token-2022 transfer-fee configuration. Transfers may include fee logic defined by the mint configuration. This is informational by default.',
    matches: (_account, mintInspection) => Boolean(mintInspection?.token2022Extensions.includes('transfer-fee-config')),
  },
  {
    kind: 'token-2022-transfer-hook',
    category: 'review',
    title: 'Token-2022 transfer hook',
    educationalText:
      'This mint has a Token-2022 transfer hook extension. Transfers can require additional hook-program logic. This indicates capability and does not by itself prove malicious intent.',
    matches: (_account, mintInspection) => Boolean(mintInspection?.token2022Extensions.includes('transfer-hook')),
  },
  {
    kind: 'token-2022-non-transferable',
    category: 'informational',
    title: 'Token-2022 non-transferable',
    educationalText:
      'This mint is marked non-transferable under Token-2022 rules. Transferability may be restricted by design. This is informational and should be interpreted in context.',
    matches: (_account, mintInspection) => Boolean(mintInspection?.token2022Extensions.includes('non-transferable')),
  },
  {
    kind: 'token-2022-default-account-state',
    category: 'review',
    title: 'Token-2022 default account state',
    educationalText:
      'This mint has a default account state configured for new token accounts. Review how that default state affects usability. Configuration alone is not proof of abuse.',
    matches: (_account, mintInspection) => (
      Boolean(mintInspection?.token2022Extensions.includes('default-account-state'))
      && mintInspection?.defaultAccountState === 'frozen'
    ),
  },
  {
    kind: 'token-2022-default-account-state',
    category: 'informational',
    title: 'Token-2022 default account state',
    educationalText:
      'This mint has a default account state configured for new token accounts. Here the default is initialized, which is informational context and not a safety verdict.',
    matches: (_account, mintInspection) => (
      Boolean(mintInspection?.token2022Extensions.includes('default-account-state'))
      && mintInspection?.defaultAccountState === 'initialized'
    ),
  },
  {
    kind: 'token-2022-interest-bearing-config',
    category: 'informational',
    title: 'Token-2022 interest-bearing config',
    educationalText:
      'This mint has an interest-bearing configuration under Token-2022. Yield or rate behavior may apply by mint design. This is informational context.',
    matches: (_account, mintInspection) => Boolean(mintInspection?.token2022Extensions.includes('interest-bearing-config')),
  },
  {
    kind: 'token-2022-metadata-pointer',
    category: 'informational',
    title: 'Token-2022 metadata pointer',
    educationalText:
      'This mint has a metadata pointer extension. Metadata location can be configured by mint rules. Presence alone does not classify safety.',
    matches: (_account, mintInspection) => Boolean(mintInspection?.token2022Extensions.includes('metadata-pointer')),
  },
  {
    kind: 'token-2022-group-pointer',
    category: 'informational',
    title: 'Token-2022 group pointer',
    educationalText:
      'This mint has a group pointer extension. Group relationships can be represented on-chain. This is informational context, not a verdict.',
    matches: (_account, mintInspection) => Boolean(mintInspection?.token2022Extensions.includes('group-pointer')),
  },
  {
    kind: 'token-2022-group-member-pointer',
    category: 'informational',
    title: 'Token-2022 group member pointer',
    educationalText:
      'This mint has a group member pointer extension. Group membership linkage is configurable under Token-2022. Presence does not prove malicious behavior.',
    matches: (_account, mintInspection) => Boolean(mintInspection?.token2022Extensions.includes('group-member-pointer')),
  },
];

function createSignal(
  definition: WalletSafetySignalDefinition,
  account: WalletTokenAccountInspection,
): WalletSafetySignal {
  return {
    id: `${definition.kind}:${account.tokenAccountAddress}`,
    kind: definition.kind,
    category: definition.category,
    tokenAccountAddress: account.tokenAccountAddress,
    mintAddress: account.mintAddress,
    title: definition.title,
    educationalText: definition.educationalText,
  };
}

export function deriveWalletSafetySignals(accounts: WalletTokenAccountInspection[]): WalletSafetySignal[] {
  const signals: WalletSafetySignal[] = [];

  for (const account of accounts) {
    for (const definition of SIGNAL_DEFINITIONS) {
      if (!definition.matches(account, null)) continue;
      signals.push(createSignal(definition, account));
    }
  }

  return signals;
}

export function deriveWalletSafetySignalsWithMints(
  accounts: WalletTokenAccountInspection[],
  mintInspections: WalletMintInspection[] = [],
): WalletSafetySignal[] {
  const signals: WalletSafetySignal[] = [];
  const mintByAddress = new Map(mintInspections.map((mintInspection) => [mintInspection.mintAddress, mintInspection]));

  for (const account of accounts) {
    const mintInspection = mintByAddress.get(account.mintAddress) ?? null;
    for (const definition of SIGNAL_DEFINITIONS) {
      if (!definition.matches(account, mintInspection)) continue;
      signals.push(createSignal(definition, account));
    }
  }

  return signals;
}
