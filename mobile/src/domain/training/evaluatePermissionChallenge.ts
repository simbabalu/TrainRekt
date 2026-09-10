import {
  PermissionChallengeDecision,
  PermissionChallengeExercise,
  TrainingExerciseResult,
} from '@/types/exercise';

export function evaluatePermissionChallenge(
  exercise: PermissionChallengeExercise,
  decision: PermissionChallengeDecision,
): TrainingExerciseResult {
  const isCorrect = decision === exercise.expectedDecision;

  return {
    isCorrect,
    xpEarned: isCorrect ? exercise.xpReward : 30,
    title: getResultTitle(isCorrect, decision, exercise.expectedDecision),
    explanation: exercise.explanation,
    learningPoints: exercise.learningPoints,
    permissionChallenge: {
      appName: exercise.request.appName,
      displayedDomain: exercise.request.displayedDomain,
      requestedOrigin: exercise.request.requestedOrigin,
      permissionType: exercise.request.permissionType,
      permissions: exercise.request.permissions,
      contextualFacts: exercise.request.contextualFacts,
      riskSignals: exercise.postDecisionAnalysis.riskSignals,
      reassuringSignals: exercise.postDecisionAnalysis.reassuringSignals,
      ruleToRemember: exercise.ruleToRemember,
    },
  };
}

function getResultTitle(
  isCorrect: boolean,
  decision: PermissionChallengeDecision,
  expectedDecision: PermissionChallengeDecision,
): string {
  if (isCorrect) return 'Good decision';
  if (decision === 'allow' && expectedDecision !== 'allow') return 'Risky decision';
  if (decision === 'needs-review') return 'Incomplete decision';
  return 'Overly defensive decision';
}
