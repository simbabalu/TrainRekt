import { DailyTrainingState } from '@/types/progress';

export interface DailyGoalProgress {
  completed: number;
  goal: number;
  percentage: number;
  isComplete: boolean;
}

export function calculateDailyGoalProgress(daily: DailyTrainingState): DailyGoalProgress {
  const completed = Math.min(daily.todayCompletedDecisions, daily.dailyGoal);
  const percentage = daily.dailyGoal === 0 ? 0 : Math.round((completed / daily.dailyGoal) * 100);
  return { completed, goal: daily.dailyGoal, percentage, isComplete: daily.dailyGoalCompleted };
}
