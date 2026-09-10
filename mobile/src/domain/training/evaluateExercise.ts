import { evaluateDecision } from './evaluateDecision';
import { evaluatePermissionChallenge } from './evaluatePermissionChallenge';
import { evaluateSignatureSimulation } from './evaluateSignatureSimulation';
import { evaluateTransactionInspection } from './evaluateTransactionInspection';
import { DecisionId } from '@/types/scenario';
import {
  PermissionChallengeDecision,
  SignatureDecision,
  TrainingExercise,
  TrainingExerciseResult,
  TransactionInspectionDecision,
} from '@/types/exercise';

export type ExerciseAnswer = DecisionId | SignatureDecision | TransactionInspectionDecision | PermissionChallengeDecision;

// Single controlled dispatch point: no wallet, signing, or network calls happen here or downstream.
export function evaluateExercise(exercise: TrainingExercise, answer: ExerciseAnswer): TrainingExerciseResult {
  if (exercise.type === 'signature-simulation') {
    return evaluateSignatureSimulation(exercise, answer as SignatureDecision);
  }
  if (exercise.type === 'transaction-inspection') {
    return evaluateTransactionInspection(exercise, answer as TransactionInspectionDecision);
  }
  if (exercise.type === 'permission-challenge') {
    return evaluatePermissionChallenge(exercise, answer as PermissionChallengeDecision);
  }
  return evaluateDecision(exercise, answer as DecisionId);
}
