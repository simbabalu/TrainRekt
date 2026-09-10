import { Training } from '@/constants/theme';
import { DailyTrainingState } from '@/types/progress';
import { TrainingMode } from '@/types/training';
import { getLocalDateKey } from './getLocalDateKey';
import { isYesterday } from './isYesterday';
import { normalizeDailyTrainingState } from './normalizeDailyTrainingState';

export interface DailyTrainingCompletionResult {
  daily: DailyTrainingState;
  bonusXpAwarded: number;
}

export function applyDailyTrainingCompletion(daily: DailyTrainingState, mode: TrainingMode, now: Date = new Date()): DailyTrainingCompletionResult {
  const rolledOver = normalizeDailyTrainingState(daily, now);

  // Practice sessions and an already-completed goal never grow the daily counter or streak.
  if (mode === 'practice' || rolledOver.dailyGoalCompleted) {
    return { daily: rolledOver, bonusXpAwarded: 0 };
  }

  const todayCompletedDecisions = Math.min(rolledOver.todayCompletedDecisions + 1, rolledOver.dailyGoal);
  const goalJustReached = todayCompletedDecisions >= rolledOver.dailyGoal;

  if (!goalJustReached) {
    return { daily: { ...rolledOver, todayCompletedDecisions }, bonusXpAwarded: 0 };
  }

  const currentDateKey = getLocalDateKey(now);
  const continuesStreak = rolledOver.lastDailyCompletionDate !== null && isYesterday(rolledOver.lastDailyCompletionDate, now);
  const dailyTrainingStreak = continuesStreak ? rolledOver.dailyTrainingStreak + 1 : 1;

  return {
    daily: {
      ...rolledOver,
      todayCompletedDecisions,
      dailyGoalCompleted: true,
      lastDailyCompletionDate: currentDateKey,
      dailyTrainingStreak,
      bestDailyTrainingStreak: Math.max(rolledOver.bestDailyTrainingStreak, dailyTrainingStreak),
    },
    bonusXpAwarded: Training.dailyCompletionBonusXp,
  };
}
