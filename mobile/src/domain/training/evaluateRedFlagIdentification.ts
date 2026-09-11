import {
  RedFlagIdentificationAnswer,
  RedFlagIdentificationExercise,
  RedFlagItem,
  TrainingExerciseResult,
} from '@/types/exercise';

export function evaluateRedFlagIdentification(
  exercise: RedFlagIdentificationExercise,
  answer: RedFlagIdentificationAnswer,
): TrainingExerciseResult {
  const expected = new Set(exercise.expectedRedFlagIds);
  const selectedIds = Array.from(new Set(answer.selectedRedFlagIds));
  const selectedSet = new Set(selectedIds);

  const allItemsById = new Map(exercise.scenario.observableItems.map((item) => [item.id, item]));
  const correctRedFlags = selectedIds
    .filter((id) => expected.has(id))
    .map((id) => allItemsById.get(id))
    .filter((item): item is RedFlagItem => Boolean(item));

  const missedRedFlags = exercise.expectedRedFlagIds
    .filter((id) => !selectedSet.has(id))
    .map((id) => allItemsById.get(id))
    .filter((item): item is RedFlagItem => Boolean(item));

  const falsePositives = selectedIds
    .filter((id) => !expected.has(id))
    .map((id) => allItemsById.get(id))
    .filter((item): item is RedFlagItem => Boolean(item));

  const selectedCorrectCount = correctRedFlags.length;
  const missedCount = missedRedFlags.length;
  const falsePositiveCount = falsePositives.length;
  const denominator = exercise.expectedRedFlagIds.length + falsePositiveCount;
  const accuracyPercent = clampPercent(denominator === 0 ? 100 : Math.round((selectedCorrectCount / denominator) * 100));
  const isPerfect = missedCount === 0 && falsePositiveCount === 0;

  return {
    isCorrect: isPerfect,
    xpEarned: isPerfect ? exercise.xpReward : 30,
    title: isPerfect ? 'Good decision' : 'Needs more precision',
    explanation: exercise.explanation,
    learningPoints: exercise.learningPoints,
    redFlagIdentification: {
      selectedCorrectCount,
      missedCount,
      falsePositiveCount,
      accuracyPercent,
      correctRedFlags,
      missedRedFlags,
      falsePositives,
      ruleToRemember: exercise.ruleToRemember,
    },
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
