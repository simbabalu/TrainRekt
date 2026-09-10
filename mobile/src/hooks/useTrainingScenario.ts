import { useRef, useState } from 'react';

import { scenarioCatalog } from '@/data/scenarioCatalog';
import { evaluateDecision } from '@/domain/training/evaluateDecision';
import { useRecommendedTraining } from '@/hooks/useRecommendedTraining';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { DecisionId, DecisionResult } from '@/types/scenario';

export function useTrainingScenario() {
  const { recordTrainingResult } = useTrainingProgress();
  const recommendedScenario = useRecommendedTraining();
  const [currentScenarioId, setCurrentScenarioId] = useState(recommendedScenario.id);
  const [selectedDecision, setSelectedDecision] = useState<DecisionId | null>(null);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const answeredScenarioId = useRef<string | null>(null);
  const currentScenario = scenarioCatalog.find((scenario) => scenario.id === currentScenarioId) ?? recommendedScenario;
  const nextRecommendation = useRecommendedTraining(currentScenario.id);

  function submitDecision(decision: DecisionId) {
    if (answeredScenarioId.current === currentScenario.id) return;
    answeredScenarioId.current = currentScenario.id;
    const decisionResult = evaluateDecision(currentScenario, decision);
    setSelectedDecision(decision);
    setResult(decisionResult);
    recordTrainingResult(currentScenario, decisionResult);
  }

  function nextScenario() {
    setCurrentScenarioId(nextRecommendation.id);
    answeredScenarioId.current = null;
    setSelectedDecision(null);
    setResult(null);
  }

  return { currentScenario, selectedDecision, result, hasAnswered: Boolean(result), submitDecision, nextScenario };
}