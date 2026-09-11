import type { WalletSafetySignalKind } from './walletInspection';

export type WalletTrainingTopic =
  | 'token-account-state'
  | 'delegated-authority'
  | 'token-2022'
  | 'empty-token-account';

export type WalletTrainingPriority = 'high' | 'medium' | 'low';

export interface WalletTrainingRecommendation {
  topic: WalletTrainingTopic;
  priority: WalletTrainingPriority;
  reason: string;
  sourceSignalType: WalletSafetySignalKind;
  observedAccountCount: number;
  recommendedExerciseIds: readonly string[];
}

export function isWalletTrainingTopic(value: unknown): value is WalletTrainingTopic {
  return value === 'token-account-state'
    || value === 'delegated-authority'
    || value === 'token-2022'
    || value === 'empty-token-account';
}
