import {
  ScamDetectionDecision,
  ScamDetectionExercise,
  TrainingExerciseResult,
} from '@/types/exercise';

export function evaluateScamDetection(
  exercise: ScamDetectionExercise,
  decision: ScamDetectionDecision,
): TrainingExerciseResult {
  const isCorrect = decision === exercise.expectedDecision;

  return {
    isCorrect,
    xpEarned: isCorrect ? exercise.xpReward : 30,
    title: getResultTitle(isCorrect, decision, exercise.expectedDecision),
    explanation: exercise.explanation,
    learningPoints: exercise.learningPoints,
    scamDetection: {
      sourceType: exercise.scenario.sourceType,
      senderOrApp: exercise.scenario.senderOrApp,
      displayedDomain: exercise.scenario.displayedDomain,
      destinationDomain: exercise.scenario.destinationDomain,
      headline: exercise.scenario.headline,
      message: exercise.scenario.message,
      neutralFacts: exercise.scenario.neutralFacts,
      riskSignals: exercise.postDecisionAnalysis.riskSignals,
      reassuringSignals: exercise.postDecisionAnalysis.reassuringSignals,
      ruleToRemember: exercise.ruleToRemember,
    },
  };
}

function getResultTitle(
  isCorrect: boolean,
  decision: ScamDetectionDecision,
  expectedDecision: ScamDetectionDecision,
): string {
  if (isCorrect) return 'Good decision';
  if (decision === 'safe' && expectedDecision !== 'safe') return 'Risky decision';
  if (decision === 'suspicious') return 'Incomplete decision';
  return 'Overly defensive decision';
}
