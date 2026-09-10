import { DailyTrainingState } from '@/types/progress';

export interface DailyTrainingStep {
  currentStep: number;
  totalSteps: number;
  isComplete: boolean;
}

export function getDailyTrainingStep(daily: DailyTrainingState): DailyTrainingStep {
  const totalSteps = daily.dailyGoal;
  const currentStep = Math.min(daily.todayCompletedDecisions + 1, totalSteps);
  return { currentStep, totalSteps, isComplete: daily.dailyGoalCompleted };
}
