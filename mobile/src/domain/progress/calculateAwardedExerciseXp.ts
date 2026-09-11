import type { TrainingMode } from '@/types/training';

export const PRACTICE_XP_MULTIPLIER = 0.25;

export interface AwardedExerciseXpInput {
  baseXp: number;
  mode: TrainingMode;
  source?: 'adaptive' | 'wallet';
  walletRewardAlreadyClaimed?: boolean;
}

export function calculateAwardedExerciseXp({ baseXp, mode, source = 'adaptive', walletRewardAlreadyClaimed = false }: AwardedExerciseXpInput): number {
  if (!Number.isFinite(baseXp) || baseXp <= 0) return 0;
  if (mode === 'daily') return Math.round(baseXp);
  if (source === 'wallet' && walletRewardAlreadyClaimed) return 0;
  return Math.round(baseXp * PRACTICE_XP_MULTIPLIER);
}