import { SurpriseChallengeDelay } from '@/types/surpriseChallenge';

export function calculateSurpriseDelayMs(
  delay: SurpriseChallengeDelay | undefined,
  randomValue: number,
): number {
  if (!delay) return 0;
  const min = Math.max(0, Math.floor(delay.minMs));
  const max = Math.max(min, Math.floor(delay.maxMs));
  const ratio = Number.isFinite(randomValue) ? Math.max(0, Math.min(1, randomValue)) : 0;
  return min + Math.round((max - min) * ratio);
}
