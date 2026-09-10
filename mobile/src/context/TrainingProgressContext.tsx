import { createContext, PropsWithChildren, useReducer, useRef } from 'react';

import { mockProgress } from '@/data/mockProgress';
import { applyTrainingResult } from '@/domain/progress/applyTrainingResult';
import { createProgressSnapshot } from '@/domain/progress/calculateLevel';
import { DecisionResult, TrainingScenario } from '@/types/scenario';
import { TrainingProgress, TrainingProgressSnapshot } from '@/types/progress';

interface ApplyResultAction {
  type: 'apply-result';
  scenario: TrainingScenario;
  result: DecisionResult;
  historyId: string;
  timestamp: string;
}

type ProgressAction = ApplyResultAction;

interface TrainingProgressContextValue {
  progress: TrainingProgressSnapshot;
  recordTrainingResult: (scenario: TrainingScenario, result: DecisionResult) => void;
}

export const TrainingProgressContext = createContext<TrainingProgressContextValue | null>(null);

function progressReducer(progress: TrainingProgress, action: ProgressAction): TrainingProgress {
  return applyTrainingResult(progress, action.scenario, action.result, {
    historyId: action.historyId,
    timestamp: action.timestamp,
  });
}

export function TrainingProgressProvider({ children }: PropsWithChildren) {
  const [progressState, dispatch] = useReducer(progressReducer, mockProgress);
  const historySequence = useRef(0);

  function recordTrainingResult(scenario: TrainingScenario, result: DecisionResult) {
    historySequence.current += 1;
    dispatch({
      type: 'apply-result',
      scenario,
      result,
      historyId: `training-${Date.now()}-${historySequence.current}`,
      timestamp: new Date().toISOString(),
    });
  }

  return (
    <TrainingProgressContext.Provider value={{ progress: createProgressSnapshot(progressState), recordTrainingResult }}>
      {children}
    </TrainingProgressContext.Provider>
  );
}