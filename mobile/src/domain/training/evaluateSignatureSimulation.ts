import { SignatureDecision, SignatureSimulationExercise, TrainingExerciseResult } from '@/types/exercise';

export function evaluateSignatureSimulation(exercise: SignatureSimulationExercise, decision: SignatureDecision): TrainingExerciseResult {
  const isCorrect = decision === exercise.expectedDecision;
  return {
    isCorrect,
    xpEarned: isCorrect ? exercise.xpReward : 30,
    title: getResultTitle(isCorrect, decision),
    explanation: exercise.explanation,
    learningPoints: exercise.learningPoints,
  };
}

function getResultTitle(isCorrect: boolean, decision: SignatureDecision): string {
  if (isCorrect) return 'Good decision';
  return decision === 'sign' ? 'Dangerous decision' : 'Risky decision';
}
