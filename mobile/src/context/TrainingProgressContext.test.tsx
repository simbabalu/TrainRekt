import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { mockProgress } from '@/data/mockProgress';
import { TrainingProgressProvider } from './TrainingProgressContext';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

const storageMock = vi.hoisted(() => ({
  loadTrainingProgress: vi.fn(),
  saveTrainingProgress: vi.fn().mockResolvedValue(undefined),
  clearTrainingProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/storage/trainingProgressStorage', () => storageMock);

describe('TrainingProgressProvider hydration', () => {
  it('does not persist defaults before hydration completes', async () => {
    let resolveLoad!: (progress: typeof mockProgress) => void;
    storageMock.loadTrainingProgress.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
    let isHydrated = false;

    function Harness() {
      isHydrated = useTrainingProgress().isHydrated;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><Harness /></TrainingProgressProvider>);
    });

    expect(isHydrated).toBe(false);
    expect(storageMock.saveTrainingProgress).not.toHaveBeenCalled();

    await act(async () => {
      resolveLoad(mockProgress);
      await Promise.resolve();
    });

    expect(isHydrated).toBe(true);
    expect(storageMock.saveTrainingProgress).toHaveBeenCalledTimes(1);
  });
});
