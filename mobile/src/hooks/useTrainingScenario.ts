import { useState } from 'react';

import { mockScenarios } from '@/data/mockScenarios';
import { evaluateDecision } from '@/domain/training/evaluateDecision';
import { DecisionId, DecisionResult } from '@/types/scenario';

export function useTrainingScenario() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedDecision, setSelectedDecision] = useState<DecisionId | null>(null);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const currentScenario = mockScenarios[scenarioIndex];

  function submitDecision(decision: DecisionId) {
    if (result) return;
    setSelectedDecision(decision);
    setResult(evaluateDecision(currentScenario, decision));
  }

  function nextScenario() {
    setScenarioIndex((index) => (index + 1) % mockScenarios.length);
    setSelectedDecision(null);
    setResult(null);
  }

  return { currentScenario, selectedDecision, result, submitDecision, nextScenario };
}