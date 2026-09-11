import type { WalletSafetySignal, WalletSafetySignalKind, WalletTokenAccountInspection } from '@/types/walletInspection';

interface WalletSafetySignalDefinition {
  kind: WalletSafetySignalKind;
  category: WalletSafetySignal['category'];
  title: string;
  educationalText: string;
  matches: (account: WalletTokenAccountInspection) => boolean;
}

const SIGNAL_DEFINITIONS: readonly WalletSafetySignalDefinition[] = [
  {
    kind: 'frozen-account',
    category: 'review',
    title: 'Frozen account',
    educationalText:
      'This token account is currently frozen. A frozen account cannot transfer tokens until the relevant authority allows it.',
    matches: (account) => account.state === 'frozen',
  },
  {
    kind: 'delegated-account',
    category: 'review',
    title: 'Delegated account',
    educationalText:
      'Another address has delegated authority over tokens in this account. Review whether you expect that permission.',
    matches: (account) => Boolean(account.delegateAddress),
  },
  {
    kind: 'token-2022-account',
    category: 'informational',
    title: 'Token-2022',
    educationalText:
      "This asset uses Solana's Token-2022 program, which supports additional token features. Token-2022 itself is not a warning.",
    matches: (account) => account.program === 'token-2022',
  },
  {
    kind: 'empty-token-account',
    category: 'informational',
    title: 'Empty token account',
    educationalText:
      'This account currently contains no tokens. Empty token accounts can remain on-chain and are not inherently suspicious.',
    matches: (account) => account.rawAmount === '0',
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
      if (!definition.matches(account)) continue;
      signals.push(createSignal(definition, account));
    }
  }

  return signals;
}
