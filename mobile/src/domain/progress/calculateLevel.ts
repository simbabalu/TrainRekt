import { Training } from '@/constants/theme';
import { ProgressSummary, TrainingProgress } from '@/types/progress';

export function calculateLevel(totalXp: number): Pick<ProgressSummary, 'level' | 'xpIntoCurrentLevel' | 'xpRequiredForNextLevel'> {
  const normalizedXp = Math.max(0, totalXp);
  return {
    level: Math.floor(normalizedXp / Training.xpPerLevel) + 1,
    xpIntoCurrentLevel: normalizedXp % Training.xpPerLevel,
    xpRequiredForNextLevel: Training.xpPerLevel,
  };
}

export function createProgressSnapshot(progress: TrainingProgress): TrainingProgress & ProgressSummary {
  return {
    ...progress,
    ...calculateLevel(progress.totalXp),
    winRate: calculateWinRate(progress.correctDecisions, progress.wrongDecisions),
  };
}

export function calculateWinRate(correctDecisions: number, wrongDecisions: number): number {
  const totalDecisions = correctDecisions + wrongDecisions;
  if (totalDecisions === 0) return 0;
  return Math.round((correctDecisions / totalDecisions) * 100);
}