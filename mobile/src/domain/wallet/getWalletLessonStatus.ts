import type { WalletLessonProgress } from '@/types/progress';

export type WalletLessonStatus = 'not-started' | 'passed' | 'failed';

export function getWalletLessonStatus({ exerciseId, walletLessonProgress }: { exerciseId: string | undefined; walletLessonProgress: Readonly<WalletLessonProgress> }): WalletLessonStatus {
  if (!exerciseId) return 'not-started';
  const latestAttempt = walletLessonProgress[exerciseId];
  if (!latestAttempt) return 'not-started';
  return latestAttempt.passed ? 'passed' : 'failed';
}