import { Training } from '@/constants/theme';
import { DailyTrainingState } from '@/types/progress';
import { getLocalDateKey } from './getLocalDateKey';

export function createDefaultDailyTrainingState(now: Date = new Date()): DailyTrainingState {
  return {
    dailyGoal: Training.dailyGoal,
    todayCompletedDecisions: 0,
    todayDateKey: getLocalDateKey(now),
    dailyGoalCompleted: false,
    lastDailyCompletionDate: null,
    dailyTrainingStreak: 0,
    bestDailyTrainingStreak: 0,
  };
}

export function normalizeDailyTrainingState(daily: DailyTrainingState, now: Date = new Date()): DailyTrainingState {
  const currentDateKey = getLocalDateKey(now);
  if (daily.todayDateKey === currentDateKey) return daily;
  return { ...daily, todayDateKey: currentDateKey, todayCompletedDecisions: 0, dailyGoalCompleted: false };
}
