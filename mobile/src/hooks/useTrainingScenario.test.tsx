import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { TrainingProgressProvider } from '@/context/TrainingProgressContext';
import { useTrainingProgress } from './useTrainingProgress';
import { useTrainingScenario } from './useTrainingScenario';
import { TrainingProgressSnapshot } from '@/types/progress';

type ScenarioController = ReturnType<typeof useTrainingScenario>;

describe('useTrainingScenario', () => {
  it('does not award progress twice for duplicate decision presses', () => {
    let controller!: ScenarioController;
    let progress!: TrainingProgressSnapshot;

    function Harness() {
      controller = useTrainingScenario();
      progress = useTrainingProgress().progress;
      return null;
    }

    act(() => {
      create(<TrainingProgressProvider><Harness /></TrainingProgressProvider>);
    });

    const initialXp = progress.totalXp;
    const initialSessions = progress.sessionsCompleted;
    act(() => {
      controller.submitDecision('take-profit');
      controller.submitDecision('take-profit');
    });

    expect(progress.totalXp).toBe(initialXp + 120);
    expect(progress.sessionsCompleted).toBe(initialSessions + 1);
    expect(progress.recentTrainingHistory).toHaveLength(4);
  });
});