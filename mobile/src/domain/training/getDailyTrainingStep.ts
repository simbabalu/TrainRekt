import { DailyTrainingState } from '@/types/progress';

export interface DailyTrainingStep {
  currentStep: number;
  totalSteps: number;
  isComplete: boolean;
  percentage: number;
}

export function getDailyTrainingStep(daily: DailyTrainingState): DailyTrainingStep {
  const totalSteps = daily.dailyGoal;
  const currentStep = Math.min(daily.todayCompletedDecisions + 1, totalSteps);
  const percentage = totalSteps <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((currentStep / totalSteps) * 100)));
  return { currentStep, totalSteps, isComplete: daily.dailyGoalCompleted, percentage };
}
