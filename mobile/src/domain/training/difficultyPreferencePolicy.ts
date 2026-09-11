import { ExerciseDifficulty } from '@/types/exercise';
import { TrainingDifficulty } from '@/types/settings';

export const difficultyPreferenceWeights: Record<TrainingDifficulty, Record<ExerciseDifficulty, number>> = {
  Beginner: { Beginner: 1, Intermediate: 0.35, Advanced: 0.1 },
  Intermediate: { Beginner: 0.35, Intermediate: 1, Advanced: 0.35 },
  Advanced: { Beginner: 0.1, Intermediate: 0.35, Advanced: 1 },
};

export function getDifficultyPreferenceWeight(
  preferredDifficulty: TrainingDifficulty,
  exerciseDifficulty: ExerciseDifficulty,
): number {
  return difficultyPreferenceWeights[preferredDifficulty][exerciseDifficulty];
}