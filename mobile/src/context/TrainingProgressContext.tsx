import { createContext, PropsWithChildren, useEffect, useReducer, useRef, useState } from 'react';

import { mockProgress } from '@/data/mockProgress';
import { applyTrainingResult } from '@/domain/progress/applyTrainingResult';
import { createProgressSnapshot } from '@/domain/progress/calculateLevel';
import { DecisionResult, TrainingScenario } from '@/types/scenario';
import { TrainingProgress, TrainingProgressSnapshot } from '@/types/progress';
import { clearTrainingProgress, loadTrainingProgress, saveTrainingProgress } from '@/storage/trainingProgressStorage';

interface ApplyResultAction {
  type: 'apply-result';
  scenario: TrainingScenario;
  result: DecisionResult;
  historyId: string;
  timestamp: string;
}

interface HydrateAction {
  type: 'hydrate';
  progress: TrainingProgress;
}

type ProgressAction = ApplyResultAction | HydrateAction;

interface TrainingProgressContextValue {
  progress: TrainingProgressSnapshot;
  isHydrated: boolean;
  recordTrainingResult: (scenario: TrainingScenario, result: DecisionResult) => void;
  resetProgress: () => Promise<void>;
}

export const TrainingProgressContext = createContext<TrainingProgressContextValue | null>(null);

function progressReducer(progress: TrainingProgress, action: ProgressAction): TrainingProgress {
  if (action.type === 'hydrate') return action.progress;
  return applyTrainingResult(progress, action.scenario, action.result, {
    historyId: action.historyId,
    timestamp: action.timestamp,
  });
}

export function TrainingProgressProvider({ children }: PropsWithChildren) {
  const [progressState, dispatch] = useReducer(progressReducer, mockProgress);
  const [isHydrated, setIsHydrated] = useState(false);
  const historySequence = useRef(0);
  const skipNextPersist = useRef(false);

  useEffect(() => {
    let isCancelled = false;
    void loadTrainingProgress().then((loadedProgress) => {
      if (isCancelled) return;
      dispatch({ type: 'hydrate', progress: loadedProgress });
      setIsHydrated(true);
    });
    return () => { isCancelled = true; };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    void saveTrainingProgress(progressState);
  }, [isHydrated, progressState]);

  function recordTrainingResult(scenario: TrainingScenario, result: DecisionResult) {
    if (!isHydrated) return;
    historySequence.current += 1;
    dispatch({
      type: 'apply-result',
      scenario,
      result,
      historyId: `training-${Date.now()}-${historySequence.current}`,
      timestamp: new Date().toISOString(),
    });
  }

  async function resetProgress() {
    skipNextPersist.current = true;
    await clearTrainingProgress();
    dispatch({ type: 'hydrate', progress: mockProgress });
  }

  return (
    <TrainingProgressContext.Provider value={{ progress: createProgressSnapshot(progressState), isHydrated, recordTrainingResult, resetProgress }}>
      {children}
    </TrainingProgressContext.Provider>
  );
}