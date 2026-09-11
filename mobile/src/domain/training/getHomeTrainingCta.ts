import { DailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { TrainingMode } from '@/types/training';

export interface HomeTrainingCta {
  mode: TrainingMode;
  label: string;
}

export function getHomeTrainingCta(goalProgress: DailyGoalProgress): HomeTrainingCta {
  if (goalProgress.isComplete) return { mode: 'practice', label: 'EXTRA PRACTICE' };
  if (goalProgress.completed > 0) return { mode: 'daily', label: 'CONTINUE TRAINING' };
  return { mode: 'daily', label: 'START TRAINING' };
}
