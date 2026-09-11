import type { WalletLessonStatus } from './getWalletLessonStatus';
import type { WalletTrainingRecommendation } from '@/types/walletTraining';

export interface WalletTrainingRecommendationWithStatus {
  recommendation: WalletTrainingRecommendation;
  status: WalletLessonStatus;
}

const statusRank: Record<WalletLessonStatus, number> = {
  failed: 0,
  'not-started': 1,
  passed: 2,
};

export function sortWalletTrainingRecommendations(
  recommendations: readonly WalletTrainingRecommendationWithStatus[],
): WalletTrainingRecommendationWithStatus[] {
  return recommendations
    .map((entry, index) => ({ entry, index }))
    .sort((first, second) => {
      const statusDelta = statusRank[first.entry.status] - statusRank[second.entry.status];
      return statusDelta !== 0 ? statusDelta : first.index - second.index;
    })
    .map(({ entry }) => entry);
}

export function getNextWalletTrainingRecommendation(
  recommendations: readonly WalletTrainingRecommendationWithStatus[],
): WalletTrainingRecommendationWithStatus | null {
  return recommendations.find(({ status }) => status === 'failed')
    ?? recommendations.find(({ status }) => status === 'not-started')
    ?? null;
}