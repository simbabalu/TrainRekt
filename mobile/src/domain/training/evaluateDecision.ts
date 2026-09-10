import { DecisionResult, DecisionId, TrainingScenario } from '@/types/scenario';

export function evaluateDecision(scenario: TrainingScenario, selectedDecision: DecisionId): DecisionResult {
  const isCorrect = selectedDecision === scenario.correctDecision;
  return {
    isCorrect,
    xpEarned: isCorrect ? scenario.reward : 30,
    title: isCorrect ? 'Good decision' : 'Risky decision',
    explanation: isCorrect
      ? scenario.explanation
      : 'The market is showing signs of overheating. Chasing strength increases your exposure just as momentum may reverse.',
  };
}