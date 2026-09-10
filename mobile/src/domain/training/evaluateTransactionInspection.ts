import { TransactionInspectionDecision, TransactionInspectionExercise, TrainingExerciseResult } from '@/types/exercise';

export function evaluateTransactionInspection(
  exercise: TransactionInspectionExercise,
  decision: TransactionInspectionDecision,
): TrainingExerciseResult {
  const isCorrect = decision === exercise.expectedDecision;

  return {
    isCorrect,
    xpEarned: isCorrect ? exercise.xpReward : 30,
    title: getResultTitle(isCorrect, decision, exercise.expectedDecision),
    explanation: exercise.explanation,
    learningPoints: exercise.learningPoints,
    transactionInspection: {
      requestingApp: exercise.requestingApp,
      requestingDomain: exercise.requestingDomain,
      network: exercise.transaction.network,
      feeSol: exercise.transaction.feeSol,
      accountChanges: exercise.transaction.accountChanges,
      tokenTransfers: exercise.transaction.tokenTransfers,
      programInvocations: exercise.transaction.programInvocations,
      instructions: exercise.transaction.instructions,
      ruleToRemember: exercise.ruleToRemember,
    },
  };
}

function getResultTitle(
  isCorrect: boolean,
  decision: TransactionInspectionDecision,
  expectedDecision: TransactionInspectionDecision,
): string {
  if (isCorrect) return 'Good decision';
  if (decision === 'approve' && expectedDecision !== 'approve') return 'Risky decision';
  if (decision === 'needs-review') return 'Incomplete decision';
  return 'Overly defensive decision';
}
