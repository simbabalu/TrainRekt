import { useRef, useState } from 'react';

import { mockScenarios } from '@/data/mockScenarios';
import { evaluateDecision } from '@/domain/training/evaluateDecision';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { DecisionId, DecisionResult } from '@/types/scenario';

export function useTrainingScenario() {
  const { recordTrainingResult } = useTrainingProgress();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedDecision, setSelectedDecision] = useState<DecisionId | null>(null);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const answeredScenarioId = useRef<string | null>(null);
  const currentScenario = mockScenarios[scenarioIndex];

  function submitDecision(decision: DecisionId) {
    if (answeredScenarioId.current === currentScenario.id) return;
    answeredScenarioId.current = currentScenario.id;
    const decisionResult = evaluateDecision(currentScenario, decision);
    setSelectedDecision(decision);
    setResult(decisionResult);
    recordTrainingResult(currentScenario, decisionResult);
  }

  function nextScenario() {
    setScenarioIndex((index) => (index + 1) % mockScenarios.length);
    answeredScenarioId.current = null;
    setSelectedDecision(null);
    setResult(null);
  }

  return { currentScenario, selectedDecision, result, submitDecision, nextScenario };
}