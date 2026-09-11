import { getWeakestSkills } from './getWeakestSkills';
import { getDifficultyPreferenceWeight } from './difficultyPreferencePolicy';
import { TrainingProgressSnapshot } from '@/types/progress';
import { TrainingDifficulty } from '@/types/settings';
import { TrainingExercise } from '@/types/exercise';

interface AdaptiveSelectionInput {
  exercises: TrainingExercise[];
  progress: TrainingProgressSnapshot;
  difficulty: TrainingDifficulty;
  currentExerciseId?: string | null;
}

export function selectAdaptiveExercise(input: AdaptiveSelectionInput, randomFn: () => number = Math.random): TrainingExercise {
  const candidates = input.exercises.filter((exercise) => exercise.id !== input.currentExerciseId);
  const pool = candidates.length > 0 ? candidates : input.exercises;
  if (pool.length === 0) throw new Error('Cannot select a training exercise from an empty catalog.');

  const weakestSkills = getWeakestSkills(input.progress.skillScores);
  const weightedCandidates = pool.map((exercise) => ({ exercise, weight: calculateExerciseWeight(exercise, input, weakestSkills) })).sort((first, second) => second.weight - first.weight);
  const totalWeight = weightedCandidates.reduce((total, candidate) => total + candidate.weight, 0);
  if (totalWeight <= 0) return pool[0];

  let target = Math.min(0.999999, Math.max(0, randomFn())) * totalWeight;
  for (const candidate of weightedCandidates) {
    target -= candidate.weight;
    if (target <= 0) return candidate.exercise;
  }
  return weightedCandidates[weightedCandidates.length - 1].exercise;
}

export function calculateExerciseWeight(exercise: TrainingExercise, input: AdaptiveSelectionInput, weakestSkills = getWeakestSkills(input.progress.skillScores)): number {
  const weakestRank = weakestSkills.findIndex((entry) => entry.skill === exercise.skill);
  const skillScore = input.progress.skillScores[exercise.skill];
  const weaknessWeight = Math.max(1, (101 - skillScore) / 10);
  const skillPriorityWeight = weakestRank === -1 ? 1 : Math.max(1, weakestSkills.length - weakestRank);
  const difficultyWeight = getDifficultyPreferenceWeight(input.difficulty, exercise.difficulty);
  const recentEntries = input.progress.recentTrainingHistory.slice(0, 3);
  const recentMistakeBonus = recentEntries.some((entry) => !entry.correct && entry.skill === exercise.skill) ? 3 : 1;
  const recentExercisePenalty = recentEntries.some((entry) => entry.scenarioId === exercise.id) ? 0.25 : 1;
  return weaknessWeight * skillPriorityWeight * difficultyWeight * recentMistakeBonus * recentExercisePenalty;
}
