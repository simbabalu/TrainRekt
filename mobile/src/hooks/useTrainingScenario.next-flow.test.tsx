import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { exerciseCatalog } from '@/data/exerciseCatalog';
import { useTrainingScenario } from './useTrainingScenario';

const useRecommendedTrainingMock = vi.hoisted(() => vi.fn());
const recordTrainingResultMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useRecommendedTraining', () => ({
  useRecommendedTraining: useRecommendedTrainingMock,
}));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: () => ({ recordTrainingResult: recordTrainingResultMock }),
}));

type ScenarioController = ReturnType<typeof useTrainingScenario>;

const firstDecision = exerciseCatalog.find((exercise) => exercise.type === 'decision')!;
const firstSignature = exerciseCatalog.find((exercise) => exercise.type === 'signature-simulation')!;
const inspectionExercises = exerciseCatalog.filter((exercise) => exercise.type === 'transaction-inspection');
const permissionExercises = exerciseCatalog.filter((exercise) => exercise.type === 'permission-challenge');
const firstInspection = inspectionExercises[0]!;
const secondInspection = inspectionExercises[1]!;
const firstPermission = permissionExercises[0]!;

Object.defineProperty(globalThis, '__DEV__', {
  value: true,
  configurable: true,
});

function getCorrectAnswer(exercise: (typeof exerciseCatalog)[number]) {
  if (exercise.type === 'decision') return exercise.correctOptionId;
  return exercise.expectedDecision;
}

describe('useTrainingScenario NEXT flow', () => {
  it('transitions decision -> permission-challenge via NEXT using the recommendation hook', () => {
    useRecommendedTrainingMock.mockImplementation((currentExerciseId?: string | null) => {
      if (!currentExerciseId) return firstDecision;
      if (currentExerciseId === firstDecision.id) return firstPermission;
      return secondInspection;
    });

    let controller!: ScenarioController;
    function Harness() {
      controller = useTrainingScenario('practice');
      return null;
    }

    act(() => {
      create(<Harness />);
    });
    expect(controller.currentExercise.type).toBe('decision');

    act(() => {
      controller.nextExercise();
    });
    expect(controller.currentExercise.type).toBe('permission-challenge');
  });

  it('transitions signature-simulation -> permission-challenge via NEXT', () => {
    useRecommendedTrainingMock.mockImplementation((currentExerciseId?: string | null) => {
      if (!currentExerciseId) return firstSignature;
      if (currentExerciseId === firstSignature.id) return firstPermission;
      return secondInspection;
    });

    let controller!: ScenarioController;
    function Harness() {
      controller = useTrainingScenario('practice');
      return null;
    }

    act(() => {
      create(<Harness />);
    });
    expect(controller.currentExercise.type).toBe('signature-simulation');

    act(() => {
      controller.nextExercise();
    });
    expect(controller.currentExercise.type).toBe('permission-challenge');
  });

  it('transitions transaction-inspection -> permission-challenge via NEXT', () => {
    useRecommendedTrainingMock.mockImplementation((currentExerciseId?: string | null) => {
      if (!currentExerciseId) return firstInspection;
      if (currentExerciseId === firstInspection.id) return firstPermission;
      return firstDecision;
    });

    let controller!: ScenarioController;
    function Harness() {
      controller = useTrainingScenario('practice');
      return null;
    }

    act(() => {
      create(<Harness />);
    });
    expect(controller.currentExercise.type).toBe('transaction-inspection');

    act(() => {
      controller.nextExercise();
    });
    expect(controller.currentExercise.type).toBe('permission-challenge');
  });

  it('transitions permission-challenge -> another eligible exercise via NEXT', () => {
    useRecommendedTrainingMock.mockImplementation((currentExerciseId?: string | null) => {
      if (!currentExerciseId) return firstPermission;
      if (currentExerciseId === firstPermission.id) return secondInspection;
      return firstDecision;
    });

    let controller!: ScenarioController;
    function Harness() {
      controller = useTrainingScenario('practice');
      return null;
    }

    act(() => {
      create(<Harness />);
    });
    expect(controller.currentExercise.id).toBe(firstPermission.id);

    act(() => {
      controller.nextExercise();
    });
    expect(controller.currentExercise.type).toBe('transaction-inspection');
  });

  it('clears answered state when NEXT loads a new exercise', () => {
    useRecommendedTrainingMock.mockImplementation((currentExerciseId?: string | null) => {
      if (!currentExerciseId) return firstDecision;
      return firstPermission;
    });

    let controller!: ScenarioController;
    function Harness() {
      controller = useTrainingScenario('practice');
      return null;
    }

    act(() => {
      create(<Harness />);
    });

    act(() => {
      controller.submitAnswer(getCorrectAnswer(controller.currentExercise));
    });
    expect(controller.hasAnswered).toBe(true);
    expect(controller.result).not.toBeNull();

    act(() => {
      controller.nextExercise();
    });

    expect(controller.hasAnswered).toBe(false);
    expect(controller.selectedAnswer).toBeNull();
    expect(controller.result).toBeNull();
  });

  it('clears answered state when DEV exercise picker selects an exercise', () => {
    useRecommendedTrainingMock.mockImplementation(() => firstDecision);

    let controller!: ScenarioController;
    function Harness() {
      controller = useTrainingScenario('practice');
      return null;
    }

    act(() => {
      create(<Harness />);
    });

    act(() => {
      controller.submitAnswer(getCorrectAnswer(controller.currentExercise));
    });
    expect(controller.hasAnswered).toBe(true);

    act(() => {
      controller.debugSelectExercise(firstPermission.id);
    });

    expect(controller.currentExercise.id).toBe(firstPermission.id);
    expect(controller.hasAnswered).toBe(false);
    expect(controller.selectedAnswer).toBeNull();
    expect(controller.result).toBeNull();
  });
});
