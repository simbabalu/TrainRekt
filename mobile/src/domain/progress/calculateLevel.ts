import { Training } from '@/constants/theme';
import { ProgressSummary, TrainingProgress } from '@/types/progress';

export function calculateLevel(totalXp: number): Pick<ProgressSummary, 'level' | 'xpIntoCurrentLevel' | 'xpRequiredForNextLevel' | 'xpToNextLevel'> {
  const normalizedXp = Math.max(0, totalXp);
  const xpIntoCurrentLevel = normalizedXp % Training.xpPerLevel;
  return {
    level: Math.floor(normalizedXp / Training.xpPerLevel) + 1,
    xpIntoCurrentLevel,
    xpRequiredForNextLevel: Training.xpPerLevel,
    xpToNextLevel: Training.xpPerLevel - xpIntoCurrentLevel,
  };
}

export function calculateProgressPercentage(xpIntoCurrentLevel: number, xpRequiredForNextLevel: number): number {
  if (xpRequiredForNextLevel <= 0) return 0;
  return Math.min(100, Math.max(0, (xpIntoCurrentLevel / xpRequiredForNextLevel) * 100));
}

export function createProgressSnapshot(progress: TrainingProgress): TrainingProgress & ProgressSummary {
  const level = calculateLevel(progress.totalXp);
  return {
    ...progress,
    ...level,
    progressPercentage: calculateProgressPercentage(level.xpIntoCurrentLevel, level.xpRequiredForNextLevel),
    winRate: calculateWinRate(progress.correctDecisions, progress.wrongDecisions),
  };
}

export function calculateWinRate(correctDecisions: number, wrongDecisions: number): number {
  const totalDecisions = correctDecisions + wrongDecisions;
  if (totalDecisions === 0) return 0;
  return Math.round((correctDecisions / totalDecisions) * 100);
}