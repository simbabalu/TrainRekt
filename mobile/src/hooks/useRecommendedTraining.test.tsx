import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { exerciseCatalog } from '@/data/exerciseCatalog';
import { mockProgress } from '@/data/mockProgress';
import { useRecommendedTraining } from './useRecommendedTraining';

const selectAdaptiveExerciseMock = vi.hoisted(() => vi.fn());
const useTrainingProgressMock = vi.hoisted(() => vi.fn());
const useSettingsMock = vi.hoisted(() => vi.fn());

vi.mock('@/domain/training/selectAdaptiveExercise', () => ({
  selectAdaptiveExercise: selectAdaptiveExerciseMock,
}));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: useTrainingProgressMock,
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: useSettingsMock,
}));

describe('useRecommendedTraining', () => {
  it('delegates to selectAdaptiveExercise with the shared runtime exercise catalog', () => {
    useTrainingProgressMock.mockReturnValue({ progress: { ...mockProgress, level: 1, xpIntoCurrentLevel: 0, xpRequiredForNextLevel: 1000, xpToNextLevel: 1000, winRate: 50 } });
    useSettingsMock.mockReturnValue({ settings: { difficulty: 'Intermediate' } });
    selectAdaptiveExerciseMock.mockReturnValue(exerciseCatalog[0]);

    function Harness() {
      useRecommendedTraining('abc-current');
      return null;
    }

    act(() => {
      create(<Harness />);
    });

    expect(selectAdaptiveExerciseMock).toHaveBeenCalledTimes(1);
    const [input] = selectAdaptiveExerciseMock.mock.calls[0] as [
      { exercises: unknown; progress: unknown; difficulty: unknown; currentExerciseId: unknown },
    ];

    expect(input.exercises).toBe(exerciseCatalog);
    expect(input.currentExerciseId).toBe('abc-current');
    expect(input.difficulty).toBe('Intermediate');
  });

  it('includes permission-challenge exercises in the delegated runtime catalog input', () => {
    useTrainingProgressMock.mockReturnValue({ progress: { ...mockProgress, level: 1, xpIntoCurrentLevel: 0, xpRequiredForNextLevel: 1000, xpToNextLevel: 1000, winRate: 50 } });
    useSettingsMock.mockReturnValue({ settings: { difficulty: 'Beginner' } });
    selectAdaptiveExerciseMock.mockReturnValue(exerciseCatalog[0]);

    function Harness() {
      useRecommendedTraining();
      return null;
    }

    act(() => {
      create(<Harness />);
    });

    const [input] = selectAdaptiveExerciseMock.mock.calls.at(-1) as [
      { exercises: { type: string }[] },
    ];
    const hasPermissionChallenge = input.exercises.some((exercise) => exercise.type === 'permission-challenge');
    expect(hasPermissionChallenge).toBe(true);
  });

  it('includes scam-detection exercises in the delegated runtime catalog input', () => {
    useTrainingProgressMock.mockReturnValue({ progress: { ...mockProgress, level: 1, xpIntoCurrentLevel: 0, xpRequiredForNextLevel: 1000, xpToNextLevel: 1000, winRate: 50 } });
    useSettingsMock.mockReturnValue({ settings: { difficulty: 'Beginner' } });
    selectAdaptiveExerciseMock.mockReturnValue(exerciseCatalog[0]);

    function Harness() {
      useRecommendedTraining();
      return null;
    }

    act(() => {
      create(<Harness />);
    });

    const [input] = selectAdaptiveExerciseMock.mock.calls.at(-1) as [
      { exercises: { type: string }[] },
    ];
    const hasScamDetection = input.exercises.some((exercise) => exercise.type === 'scam-detection');
    expect(hasScamDetection).toBe(true);
  });

  it('includes red-flag-identification exercises in the delegated runtime catalog input', () => {
    useTrainingProgressMock.mockReturnValue({ progress: { ...mockProgress, level: 1, xpIntoCurrentLevel: 0, xpRequiredForNextLevel: 1000, xpToNextLevel: 1000, winRate: 50 } });
    useSettingsMock.mockReturnValue({ settings: { difficulty: 'Beginner' } });
    selectAdaptiveExerciseMock.mockReturnValue(exerciseCatalog[0]);

    function Harness() {
      useRecommendedTraining();
      return null;
    }

    act(() => {
      create(<Harness />);
    });

    const [input] = selectAdaptiveExerciseMock.mock.calls.at(-1) as [
      { exercises: { type: string }[] },
    ];
    const hasRedFlagIdentification = input.exercises.some((exercise) => exercise.type === 'red-flag-identification');
    expect(hasRedFlagIdentification).toBe(true);
  });
});
