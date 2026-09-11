import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { TrainingProgressProvider } from '@/context/TrainingProgressContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { mockProgress } from '@/data/mockProgress';
import { TrainingProgressSnapshot } from '@/types/progress';
import { ExerciseAnswer } from '@/domain/training/evaluateExercise';
import { TrainingExercise } from '@/types/exercise';
import { useTrainingProgress } from './useTrainingProgress';
import { useTrainingScenario } from './useTrainingScenario';

const storage = vi.hoisted(() => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

type ScenarioController = ReturnType<typeof useTrainingScenario>;

function getCorrectAnswer(exercise: TrainingExercise): ExerciseAnswer {
  if (exercise.type === 'decision') return exercise.correctOptionId;
  if (exercise.type === 'red-flag-identification') return { selectedRedFlagIds: exercise.expectedRedFlagIds };
  return exercise.expectedDecision;
}

describe('useTrainingScenario', () => {
  it('does not award progress twice for duplicate decision presses', async () => {
    let controller!: ScenarioController;
    let progress!: TrainingProgressSnapshot;

    function Harness() {
      controller = useTrainingScenario('daily');
      progress = useTrainingProgress().progress;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><Harness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    const initialXp = progress.totalXp;
    const initialSessions = progress.sessionsCompleted;
    const initialDailyCount = progress.daily.todayCompletedDecisions;
    const expectedXp = controller.currentExercise.xpReward;
    const correctAnswer = getCorrectAnswer(controller.currentExercise);
    act(() => {
      controller.submitAnswer(correctAnswer);
      controller.submitAnswer(correctAnswer);
    });

    expect(progress.totalXp).toBe(initialXp + expectedXp);
    expect(progress.sessionsCompleted).toBe(initialSessions + 1);
    expect(progress.daily.todayCompletedDecisions).toBe(initialDailyCount + 1);
    expect(progress.recentTrainingHistory).toHaveLength(4);
  });

  it('awards normal XP in practice mode without touching the daily counter, streak, or completion', async () => {
    const completedProgress = { ...mockProgress, daily: { ...mockProgress.daily, todayCompletedDecisions: 3, dailyGoalCompleted: true, dailyTrainingStreak: 2, bestDailyTrainingStreak: 2 } };
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? JSON.stringify({ version: 2, data: completedProgress }) : null));

    let controller!: ScenarioController;
    let progress!: TrainingProgressSnapshot;

    function Harness() {
      controller = useTrainingScenario('practice');
      progress = useTrainingProgress().progress;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><Harness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    const initialXp = progress.totalXp;
    const expectedXp = controller.currentExercise.xpReward;
    const correctAnswer = getCorrectAnswer(controller.currentExercise);
    act(() => {
      controller.submitAnswer(correctAnswer);
      controller.submitAnswer(correctAnswer);
    });

    expect(progress.totalXp).toBe(initialXp + expectedXp);
    expect(progress.daily.todayCompletedDecisions).toBe(3);
    expect(progress.daily.dailyTrainingStreak).toBe(2);
    expect(progress.daily.dailyGoalCompleted).toBe(true);
  });
});