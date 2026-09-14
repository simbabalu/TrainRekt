import { useRef, useState } from 'react';

import { exerciseCatalog } from '@/data/exerciseCatalog';
import { findWalletLessonExercise } from '@/data/walletLessonCatalog';
import { evaluateExercise, ExerciseAnswer } from '@/domain/training/evaluateExercise';
import { calculateAwardedExerciseXp } from '@/domain/progress/calculateAwardedExerciseXp';
import { useRecommendedTraining } from '@/hooks/useRecommendedTraining';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { TrainingExerciseResult } from '@/types/exercise';
import { TrainingMode } from '@/types/training';
import type { WalletTrainingTopic } from '@/types/walletTraining';

interface UseTrainingScenarioOptions {
  source?: 'adaptive' | 'wallet' | 'token-analysis';
  topic?: WalletTrainingTopic;
  initialExerciseId?: string;
}

function findExerciseById(exerciseId: string) {
  return exerciseCatalog.find((exercise) => exercise.id === exerciseId)
    ?? findWalletLessonExercise(exerciseId);
}

export function useTrainingScenario(mode: TrainingMode, options: UseTrainingScenarioOptions = {}) {
  const { progress, recordTrainingResult, consumePreparedDemoExerciseId } = useTrainingProgress();
  const recommendedExercise = useRecommendedTraining();
  const [preparedDemoExerciseId] = useState<string | null>(() => {
    const source = options.source ?? 'adaptive';
    if (source !== 'adaptive' || mode !== 'daily' || options.initialExerciseId) return null;
    return consumePreparedDemoExerciseId();
  });
  const resolvedInitialExerciseId = options.initialExerciseId ?? preparedDemoExerciseId ?? undefined;
  const initialExercise = resolvedInitialExerciseId
    ? findExerciseById(resolvedInitialExerciseId)
    : null;
  const [currentExerciseId, setCurrentExerciseId] = useState(initialExercise?.id ?? recommendedExercise.id);
  const [selectedAnswer, setSelectedAnswer] = useState<ExerciseAnswer | null>(null);
  const [result, setResult] = useState<TrainingExerciseResult | null>(null);
  const answeredExerciseId = useRef<string | null>(null);
  const currentExercise = findExerciseById(currentExerciseId) ?? recommendedExercise;
  const nextRecommendation = useRecommendedTraining(currentExercise.id);

  function submitAnswer(answer: ExerciseAnswer) {
    if (answeredExerciseId.current === currentExercise.id) return;
    answeredExerciseId.current = currentExercise.id;
    const evaluatedResult = evaluateExercise(currentExercise, answer);
    const walletRewardAlreadyClaimed = options.source === 'wallet'
      && Boolean(progress?.walletLessonRewards.claimedExerciseIds.includes(currentExercise.id));
    const exerciseResult = {
      ...evaluatedResult,
      xpEarned: calculateAwardedExerciseXp({
        baseXp: evaluatedResult.xpEarned,
        mode,
        source: options.source,
        walletRewardAlreadyClaimed,
      }),
    };
    setSelectedAnswer(answer);
    setResult(exerciseResult);
    recordTrainingResult(currentExercise, exerciseResult, mode, options.source ?? 'adaptive');
  }

  function nextExercise() {
    setCurrentExerciseId(nextRecommendation.id);
    answeredExerciseId.current = null;
    setSelectedAnswer(null);
    setResult(null);
  }

  function debugSelectExercise(exerciseId: string) {
    if (!__DEV__) return;
    const match = exerciseCatalog.find((exercise) => exercise.id === exerciseId);
    if (!match) return;
    setCurrentExerciseId(match.id);
    answeredExerciseId.current = null;
    setSelectedAnswer(null);
    setResult(null);
  }

  return {
    currentExercise,
    selectedAnswer,
    result,
    hasAnswered: Boolean(result),
    submitAnswer,
    nextExercise,
    debugSelectExercise,
    source: options.source ?? 'adaptive',
    topic: options.topic ?? null,
    initialExerciseId: initialExercise?.id ?? null,
  };
}