import { createContext, PropsWithChildren, useEffect, useReducer, useRef, useState } from 'react';

import { applySurpriseChallengeCompletion } from '@/domain/progress/applySurpriseChallengeCompletion';
import { applyTrainingResult } from '@/domain/progress/applyTrainingResult';
import { createProgressSnapshot } from '@/domain/progress/calculateLevel';
import { createInitialTrainingProgress } from '@/domain/progress/createInitialTrainingProgress';
import { demoPreparationPolicy } from '@/domain/training/demoPreparationPolicy';
import { getLocalDateKey } from '@/domain/training/getLocalDateKey';
import { normalizeDailyTrainingState } from '@/domain/training/normalizeDailyTrainingState';
import { TrainingExercise, TrainingExerciseResult } from '@/types/exercise';
import { TrainingProgress, TrainingProgressSnapshot } from '@/types/progress';
import { SurpriseChallengeCompletionInput } from '@/types/surpriseChallenge';
import { TrainingMode } from '@/types/training';
import { clearTrainingProgress, loadTrainingProgress, saveTrainingProgress } from '@/storage/trainingProgressStorage';

interface ApplyResultAction {
  type: 'apply-result';
  exercise: TrainingExercise;
  result: TrainingExerciseResult;
  mode: TrainingMode;
  source: 'adaptive' | 'wallet' | 'token-analysis';
  historyId: string;
  timestamp: string;
}

interface HydrateAction {
  type: 'hydrate';
  progress: TrainingProgress;
}

interface DebugShiftDailyDateAction {
  type: 'debug-shift-daily-date';
}

interface CompleteSurpriseChallengeAction {
  type: 'complete-surprise-challenge';
  completion: SurpriseChallengeCompletionInput;
}

type ProgressAction = ApplyResultAction | HydrateAction | DebugShiftDailyDateAction | CompleteSurpriseChallengeAction;

interface TrainingProgressContextValue {
  progress: TrainingProgressSnapshot;
  isHydrated: boolean;
  recordTrainingResult: (exercise: TrainingExercise, result: TrainingExerciseResult, mode: TrainingMode, source?: 'adaptive' | 'wallet' | 'token-analysis') => void;
  recordSurpriseChallengeCompletion: (completion: SurpriseChallengeCompletionInput) => void;
  resetProgress: () => Promise<void>;
  prepareDemo: () => Promise<void>;
  consumePreparedDemoExerciseId: () => string | null;
  debugSimulatePreviousDay: () => void;
}

export const TrainingProgressContext = createContext<TrainingProgressContextValue | null>(null);

function isDevRuntime() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function progressReducer(progress: TrainingProgress, action: ProgressAction): TrainingProgress {
  if (action.type === 'hydrate') return action.progress;
  if (action.type === 'debug-shift-daily-date') {
    const shiftedDate = new Date(`${progress.daily.todayDateKey}T00:00:00`);
    shiftedDate.setDate(shiftedDate.getDate() - 1);
    return { ...progress, daily: { ...progress.daily, todayDateKey: getLocalDateKey(shiftedDate) } };
  }
  if (action.type === 'complete-surprise-challenge') {
    return applySurpriseChallengeCompletion(progress, action.completion);
  }
  return applyTrainingResult(progress, action.exercise, action.result, {
    historyId: action.historyId,
    timestamp: action.timestamp,
    mode: action.mode,
    source: action.source,
  });
}

export function TrainingProgressProvider({ children }: PropsWithChildren) {
  const [progressState, dispatch] = useReducer(progressReducer, undefined, createInitialTrainingProgress);
  const [isHydrated, setIsHydrated] = useState(false);
  const historySequence = useRef(0);
  const skipNextPersist = useRef(false);
  const preparedDemoExerciseIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    void loadTrainingProgress().then((loadedProgress) => {
      if (isCancelled) return;
      const normalized: TrainingProgress = { ...loadedProgress, daily: normalizeDailyTrainingState(loadedProgress.daily, new Date()) };
      dispatch({ type: 'hydrate', progress: normalized });
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

  function recordTrainingResult(exercise: TrainingExercise, result: TrainingExerciseResult, mode: TrainingMode, source: 'adaptive' | 'wallet' | 'token-analysis' = 'adaptive') {
    if (!isHydrated) return;
    historySequence.current += 1;
    dispatch({
      type: 'apply-result',
      exercise,
      result,
      mode,
      source,
      historyId: `training-${Date.now()}-${historySequence.current}`,
      timestamp: new Date().toISOString(),
    });
  }

  function recordSurpriseChallengeCompletion(completion: SurpriseChallengeCompletionInput) {
    if (!isHydrated) return;
    dispatch({ type: 'complete-surprise-challenge', completion });
  }

  async function resetProgress() {
    skipNextPersist.current = true;
    await clearTrainingProgress();
    dispatch({ type: 'hydrate', progress: createInitialTrainingProgress() });
  }

  async function prepareDemo() {
    if (!isDevRuntime()) return;
    skipNextPersist.current = true;
    await clearTrainingProgress();
    dispatch({ type: 'hydrate', progress: createInitialTrainingProgress() });
    preparedDemoExerciseIdRef.current = demoPreparationPolicy.firstDailyExerciseId;
  }

  function consumePreparedDemoExerciseId(): string | null {
    if (!isDevRuntime()) return null;
    const next = preparedDemoExerciseIdRef.current;
    preparedDemoExerciseIdRef.current = null;
    return next;
  }

  function debugSimulatePreviousDay() {
    if (!__DEV__) return;
    dispatch({ type: 'debug-shift-daily-date' });
  }

  return (
    <TrainingProgressContext.Provider value={{ progress: createProgressSnapshot(progressState), isHydrated, recordTrainingResult, recordSurpriseChallengeCompletion, resetProgress, prepareDemo, consumePreparedDemoExerciseId, debugSimulatePreviousDay }}>
      {children}
    </TrainingProgressContext.Provider>
  );
}