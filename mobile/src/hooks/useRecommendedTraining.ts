import { exerciseCatalog } from '@/data/exerciseCatalog';
import { selectAdaptiveExercise } from '@/domain/training/selectAdaptiveExercise';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

export function useRecommendedTraining(currentExerciseId?: string | null) {
  const { progress } = useTrainingProgress();
  const { settings } = useSettings();
  return selectAdaptiveExercise({ exercises: exerciseCatalog, progress, difficulty: settings.difficulty, currentExerciseId });
}