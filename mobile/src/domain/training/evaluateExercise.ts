import { evaluateDecision } from './evaluateDecision';
import { evaluateSignatureSimulation } from './evaluateSignatureSimulation';
import { DecisionId } from '@/types/scenario';
import { SignatureDecision, TrainingExercise, TrainingExerciseResult } from '@/types/exercise';

export type ExerciseAnswer = DecisionId | SignatureDecision;

// Single controlled dispatch point: no wallet, signing, or network calls happen here or downstream.
export function evaluateExercise(exercise: TrainingExercise, answer: ExerciseAnswer): TrainingExerciseResult {
  if (exercise.type === 'signature-simulation') {
    return evaluateSignatureSimulation(exercise, answer as SignatureDecision);
  }
  return evaluateDecision(exercise, answer as DecisionId);
}
