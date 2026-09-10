import { useRef, useState } from 'react';

import { exerciseCatalog } from '@/data/exerciseCatalog';
import { evaluateExercise, ExerciseAnswer } from '@/domain/training/evaluateExercise';
import { useRecommendedTraining } from '@/hooks/useRecommendedTraining';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { TrainingExerciseResult } from '@/types/exercise';
import { TrainingMode } from '@/types/training';

export function useTrainingScenario(mode: TrainingMode) {
  const { recordTrainingResult } = useTrainingProgress();
  const recommendedExercise = useRecommendedTraining();
  const [currentExerciseId, setCurrentExerciseId] = useState(recommendedExercise.id);
  const [selectedAnswer, setSelectedAnswer] = useState<ExerciseAnswer | null>(null);
  const [result, setResult] = useState<TrainingExerciseResult | null>(null);
  const answeredExerciseId = useRef<string | null>(null);
  const currentExercise = exerciseCatalog.find((exercise) => exercise.id === currentExerciseId) ?? recommendedExercise;
  const nextRecommendation = useRecommendedTraining(currentExercise.id);

  function submitAnswer(answer: ExerciseAnswer) {
    if (answeredExerciseId.current === currentExercise.id) return;
    answeredExerciseId.current = currentExercise.id;
    const exerciseResult = evaluateExercise(currentExercise, answer);
    setSelectedAnswer(answer);
    setResult(exerciseResult);
    recordTrainingResult(currentExercise, exerciseResult, mode);
  }

  function nextExercise() {
    setCurrentExerciseId(nextRecommendation.id);
    answeredExerciseId.current = null;
    setSelectedAnswer(null);
    setResult(null);
  }

  return { currentExercise, selectedAnswer, result, hasAnswered: Boolean(result), submitAnswer, nextExercise };
}