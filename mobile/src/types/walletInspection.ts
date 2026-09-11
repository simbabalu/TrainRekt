import type { SolanaNetwork } from '@/types/walletSnapshot';

export type TokenAccountProgram = 'spl-token' | 'token-2022' | 'unknown';

export type TokenAccountState = 'initialized' | 'frozen' | 'unknown';

export interface TokenDisplayMetadata {
  mint: string;
  name: string | null;
  symbol: string | null;
}

export interface WalletTokenAccountInspection {
  tokenAccountAddress: string;
  mintAddress: string;
  tokenDisplayMetadata?: TokenDisplayMetadata | null;
  program: TokenAccountProgram;
  rawAmount: string;
  decimals: number;
  uiAmount: number | null;
  state: TokenAccountState;
  delegateAddress: string | null;
  delegatedAmountRaw: string | null;
  closeAuthorityAddress: string | null;
}

export type MintAuthorityState = 'active' | 'revoked' | 'unknown';

export type Token2022ExtensionKind =
  | 'permanent-delegate'
  | 'transfer-fee-config'
  | 'transfer-hook'
  | 'non-transferable'
  | 'default-account-state'
  | 'interest-bearing-config'
  | 'metadata-pointer'
  | 'group-pointer'
  | 'group-member-pointer';

export type DefaultAccountStateValue = 'uninitialized' | 'initialized' | 'frozen' | 'unknown';

export interface WalletMintInspection {
  mintAddress: string;
  program: TokenAccountProgram;
  decimals: number | null;
  supplyRaw: string | null;
  mintAuthorityState: MintAuthorityState;
  mintAuthorityAddress: string | null;
  freezeAuthorityState: MintAuthorityState;
  freezeAuthorityAddress: string | null;
  token2022Extensions: Token2022ExtensionKind[];
  defaultAccountState: DefaultAccountStateValue | null;
  unavailableReason: string | null;
}

export type WalletSafetySignalKind =
  | 'delegated-account'
  | 'frozen-account'
  | 'token-2022-account'
  | 'empty-token-account'
  | 'mint-authority-active'
  | 'freeze-authority-active'
  | 'token-2022-permanent-delegate'
  | 'token-2022-transfer-fee-config'
  | 'token-2022-transfer-hook'
  | 'token-2022-non-transferable'
  | 'token-2022-default-account-state'
  | 'token-2022-interest-bearing-config'
  | 'token-2022-metadata-pointer'
  | 'token-2022-group-pointer'
  | 'token-2022-group-member-pointer';

export type WalletSafetySignalCategory = 'review' | 'informational';

export type WalletInspectionAccountPrimaryCategory = 'review' | 'informational' | 'normal';

export interface WalletSafetySignal {
  id: string;
  kind: WalletSafetySignalKind;
  category: WalletSafetySignalCategory;
  tokenAccountAddress: string;
  mintAddress: string;
  title: string;
  educationalText: string;
}

export interface WalletInspectionCategorySummary {
  inspectedAccountCount: number;
  reviewAccountCount: number;
  informationalAccountCount: number;
  noReviewSignalAccountCount: number;
}

export interface CategorizedWalletInspectionAccounts {
  reviewAccounts: WalletTokenAccountInspection[];
  informationalAccounts: WalletTokenAccountInspection[];
  normalAccounts: WalletTokenAccountInspection[];
  summary: WalletInspectionCategorySummary;
}

export interface WalletInspectionSummary {
  reviewedTokenAccounts: number;
  emptyTokenAccounts: number;
  frozenTokenAccounts: number;
  delegatedTokenAccounts: number;
  token2022TokenAccounts: number;
}

export interface WalletSafetyInspection {
  address: string;
  network: SolanaNetwork;
  tokenAccounts: WalletTokenAccountInspection[];
  mintInspections: WalletMintInspection[];
  inspectedAt: string;
  warnings: string[];
}

export type WalletInspectionFailureReason = 'invalid-address' | 'rpc-unavailable' | 'failed';

export class WalletInspectionServiceError extends Error {
  constructor(readonly reason: WalletInspectionFailureReason, message: string) {
    super(message);
    this.name = 'WalletInspectionServiceError';
  }
}
