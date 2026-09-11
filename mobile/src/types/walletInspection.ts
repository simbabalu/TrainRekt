import type { SolanaNetwork } from '@/types/walletSnapshot';

export type TokenAccountProgram = 'spl-token' | 'token-2022' | 'unknown';

export type TokenAccountState = 'initialized' | 'frozen' | 'unknown';

export interface WalletTokenAccountInspection {
  tokenAccountAddress: string;
  mintAddress: string;
  program: TokenAccountProgram;
  rawAmount: string;
  decimals: number;
  uiAmount: number | null;
  state: TokenAccountState;
  delegateAddress: string | null;
  delegatedAmountRaw: string | null;
  closeAuthorityAddress: string | null;
}

export type WalletSafetySignalKind = 'delegated-account' | 'frozen-account' | 'token-2022-account' | 'empty-token-account';

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
