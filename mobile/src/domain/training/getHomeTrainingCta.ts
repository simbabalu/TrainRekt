import { DailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { TrainingMode } from '@/types/training';

export interface HomeTrainingCta {
  mode: TrainingMode;
  label: string;
}

export function getHomeTrainingCta(goalProgress: DailyGoalProgress): HomeTrainingCta {
  return goalProgress.isComplete ? { mode: 'practice', label: 'EXTRA PRACTICE' } : { mode: 'daily', label: 'START TRAINING' };
}
