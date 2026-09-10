import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { TrainingProgressProvider } from '@/context/TrainingProgressContext';
import { TrainingProgressSnapshot } from '@/types/progress';
import { useTrainingProgress } from './useTrainingProgress';
import { useTrainingScenario } from './useTrainingScenario';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn().mockResolvedValue(null), setItem: vi.fn().mockResolvedValue(undefined), removeItem: vi.fn().mockResolvedValue(undefined) },
}));

type ScenarioController = ReturnType<typeof useTrainingScenario>;

describe('useTrainingScenario', () => {
  it('does not award progress twice for duplicate decision presses', async () => {
    let controller!: ScenarioController;
    let progress!: TrainingProgressSnapshot;

    function Harness() {
      controller = useTrainingScenario();
      progress = useTrainingProgress().progress;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><Harness /></TrainingProgressProvider>);
      await Promise.resolve();
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