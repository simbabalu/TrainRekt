import { evaluateDecision } from './evaluateDecision';
import { evaluateSignatureSimulation } from './evaluateSignatureSimulation';
import { evaluateTransactionInspection } from './evaluateTransactionInspection';
import { DecisionId } from '@/types/scenario';
import { SignatureDecision, TrainingExercise, TrainingExerciseResult, TransactionInspectionDecision } from '@/types/exercise';

export type ExerciseAnswer = DecisionId | SignatureDecision | TransactionInspectionDecision;

// Single controlled dispatch point: no wallet, signing, or network calls happen here or downstream.
export function evaluateExercise(exercise: TrainingExercise, answer: ExerciseAnswer): TrainingExerciseResult {
  if (exercise.type === 'signature-simulation') {
    return evaluateSignatureSimulation(exercise, answer as SignatureDecision);
  }
  if (exercise.type === 'transaction-inspection') {
    return evaluateTransactionInspection(exercise, answer as TransactionInspectionDecision);
  }
  return evaluateDecision(exercise, answer as DecisionId);
}
