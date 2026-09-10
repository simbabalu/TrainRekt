import { DailyTrainingState } from '@/types/progress';
import { TrainingMode } from '@/types/training';

export function isDailyTrainingComplete(daily: DailyTrainingState, mode: TrainingMode): boolean {
  return mode === 'daily' && daily.dailyGoalCompleted;
}
