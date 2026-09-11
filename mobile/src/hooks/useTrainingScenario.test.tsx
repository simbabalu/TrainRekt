import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { TrainingProgressProvider } from '@/context/TrainingProgressContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { findWalletLessonExercise } from '@/data/walletLessonCatalog';
import { mockProgress } from '@/data/mockProgress';
import { demoPreparationPolicy } from '@/domain/training/demoPreparationPolicy';
import { TrainingProgressSnapshot } from '@/types/progress';
import { ExerciseAnswer } from '@/domain/training/evaluateExercise';
import { TrainingExercise, TransactionInspectionDecision } from '@/types/exercise';
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

function getIncorrectWalletInspectionAnswer(exercise: TrainingExercise): TransactionInspectionDecision {
  if (exercise.type !== 'transaction-inspection') throw new Error('Expected transaction inspection exercise');
  const fallbackDecisions: TransactionInspectionDecision[] = ['approve', 'reject', 'needs-review'];
  return fallbackDecisions.find((decision) => decision !== exercise.expectedDecision) ?? 'reject';
}

describe('useTrainingScenario', () => {
  it('uses the DEV prepared deterministic daily exercise once, then consumes the seed', async () => {
    Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? JSON.stringify({ version: 4, data: createInitialProgressLike() }) : null));

    let controller!: ScenarioController;
    let progressContext!: ReturnType<typeof useTrainingProgress>;

    function Harness() {
      progressContext = useTrainingProgress();
      controller = useTrainingScenario('daily');
      return null;
    }

    function App({ revision }: { revision: number }) {
      return <TrainingProgressProvider><SettingsProvider><Harness key={`scenario-${revision}`} /></SettingsProvider></TrainingProgressProvider>;
    }

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<App revision={0} />);
      await Promise.resolve();
    });

    await act(async () => {
      await progressContext.prepareDemo();
    });

    await act(async () => {
      renderer.update(<App revision={1} />);
      await Promise.resolve();
    });

    expect(controller.currentExercise.id).toBe(demoPreparationPolicy.firstDailyExerciseId);
    expect(progressContext.consumePreparedDemoExerciseId()).toBeNull();
  });

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
    const initialHistoryLength = progress.recentTrainingHistory.length;
    const expectedXp = controller.currentExercise.xpReward;
    const correctAnswer = getCorrectAnswer(controller.currentExercise);
    act(() => {
      controller.submitAnswer(correctAnswer);
      controller.submitAnswer(correctAnswer);
    });

      expect(controller.result?.xpEarned).toBe(expectedXp);
    expect(progress.totalXp).toBe(initialXp + expectedXp);
    expect(progress.sessionsCompleted).toBe(initialSessions + 1);
    expect(progress.daily.todayCompletedDecisions).toBe(initialDailyCount + 1);
    expect(progress.recentTrainingHistory).toHaveLength(initialHistoryLength + 1);
  });

  it('awards normal XP in practice mode without touching the daily counter, streak, or completion', async () => {
    const completedProgress = { ...mockProgress, daily: { ...mockProgress.daily, todayCompletedDecisions: 3, dailyGoalCompleted: true, dailyTrainingStreak: 2, bestDailyTrainingStreak: 2 } };
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? JSON.stringify({ version: 4, data: completedProgress }) : null));

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

      expect(controller.result?.xpEarned).toBe(Math.round(expectedXp * 0.25));
    expect(progress.totalXp).toBe(initialXp + Math.round(expectedXp * 0.25));
    expect(progress.daily.todayCompletedDecisions).toBe(3);
    expect(progress.daily.dailyTrainingStreak).toBe(2);
    expect(progress.daily.dailyGoalCompleted).toBe(true);
  });

  it('loads a wallet-recommended lesson by exerciseId and records XP in practice mode without daily-goal increments', async () => {
    const seededProgress = {
      ...mockProgress,
      daily: {
        ...mockProgress.daily,
        todayCompletedDecisions: 1,
        dailyGoalCompleted: false,
        dailyTrainingStreak: 2,
      },
    };
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? JSON.stringify({ version: 4, data: seededProgress }) : null));

    let controller!: ScenarioController;
    let progress!: TrainingProgressSnapshot;

    function Harness() {
      controller = useTrainingScenario('practice', {
        source: 'wallet',
        topic: 'token-account-state',
        initialExerciseId: 'wallet-lesson-frozen-account-state',
      });
      progress = useTrainingProgress().progress;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><Harness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    const expectedExercise = findWalletLessonExercise('wallet-lesson-frozen-account-state');
    expect(expectedExercise).toBeDefined();
    expect(controller.currentExercise.id).toBe('wallet-lesson-frozen-account-state');

    const initialXp = progress.totalXp;
    const initialDailyCount = progress.daily.todayCompletedDecisions;
    const initialDailyStreak = progress.daily.dailyTrainingStreak;

    act(() => {
      controller.submitAnswer(getCorrectAnswer(controller.currentExercise));
    });

      expect(controller.result?.xpEarned).toBe(Math.round(controller.currentExercise.xpReward * 0.25));
    expect(progress.totalXp).toBe(initialXp + Math.round(controller.currentExercise.xpReward * 0.25));
    expect(progress.daily.todayCompletedDecisions).toBe(initialDailyCount);
    expect(progress.daily.dailyTrainingStreak).toBe(initialDailyStreak);
    expect(progress.daily.dailyGoalCompleted).toBe(false);
  });

  it('keeps explicit wallet lesson routing deterministic regardless of preferred difficulty', async () => {
    const seededProgress = {
      ...mockProgress,
      daily: { ...mockProgress.daily, todayCompletedDecisions: 0, dailyGoalCompleted: false },
    };
    const advancedSettings = {
      version: 4,
      data: {
        difficulty: 'Advanced',
        notificationsEnabled: true,
        soundEffectsEnabled: true,
        hapticFeedbackEnabled: true,
      },
    };
    storage.getItem.mockImplementation((key: string) => {
      if (key === '@trainrekt/training-progress') return Promise.resolve(JSON.stringify({ version: 4, data: seededProgress }));
      if (key === '@trainrekt/settings') return Promise.resolve(JSON.stringify(advancedSettings));
      return Promise.resolve(null);
    });

    let controller!: ScenarioController;
    function Harness() {
      controller = useTrainingScenario('practice', {
        source: 'wallet',
        topic: 'token-account-state',
        initialExerciseId: 'wallet-lesson-frozen-account-state',
      });
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><Harness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    expect(controller.currentExercise.id).toBe('wallet-lesson-frozen-account-state');
  });

  it('records wallet retries with zero XP while preserving Daily state and history', async () => {
    const exerciseId = 'wallet-lesson-frozen-account-state';
    const seededProgress = {
      ...mockProgress,
      totalXp: 30,
      recentTrainingHistory: [],
      walletLessonRewards: { claimedExerciseIds: [exerciseId] },
      walletLessonProgress: {
        [exerciseId]: {
          passed: false,
          completedAt: '2026-09-11T10:00:00.000Z',
        },
      },
      daily: { ...mockProgress.daily, todayCompletedDecisions: 1, dailyTrainingStreak: 2, dailyGoalCompleted: false },
    };
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? JSON.stringify({ version: 4, data: seededProgress }) : null));

    let controller!: ScenarioController;
    let progress!: TrainingProgressSnapshot;
    function Harness() {
      controller = useTrainingScenario('practice', { source: 'wallet', topic: 'token-account-state', initialExerciseId: exerciseId });
      progress = useTrainingProgress().progress;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><Harness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    const initialHistoryLength = progress.recentTrainingHistory.length;
    const initialDaily = progress.daily;
    act(() => controller.submitAnswer(getCorrectAnswer(controller.currentExercise)));

    expect(controller.result?.xpEarned).toBe(0);
    expect(progress.totalXp).toBe(30);
    expect(progress.recentTrainingHistory).toHaveLength(initialHistoryLength + 1);
    expect(progress.recentTrainingHistory[0].scenarioId).toBe(exerciseId);
    expect(progress.walletLessonProgress[exerciseId]?.passed).toBe(true);
    expect(progress.daily.todayCompletedDecisions).toBe(initialDaily.todayCompletedDecisions);
    expect(progress.daily.dailyTrainingStreak).toBe(initialDaily.dailyTrainingStreak);
  });

  it('consumes wallet reward eligibility on first incorrect attempt and keeps retries at zero after restart', async () => {
    const exerciseId = 'wallet-lesson-frozen-account-state';
    const initialProgress = {
      ...mockProgress,
      totalXp: 0,
      recentTrainingHistory: [],
      walletLessonRewards: { claimedExerciseIds: [] },
      walletLessonProgress: {},
      daily: { ...mockProgress.daily, todayCompletedDecisions: 0, dailyGoalCompleted: false },
    };
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? JSON.stringify({ version: 4, data: initialProgress }) : null));

    let firstController!: ScenarioController;
    let firstProgress!: TrainingProgressSnapshot;

    function FirstHarness() {
      firstController = useTrainingScenario('practice', { source: 'wallet', topic: 'token-account-state', initialExerciseId: exerciseId });
      firstProgress = useTrainingProgress().progress;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><FirstHarness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    act(() => {
      firstController.submitAnswer(getIncorrectWalletInspectionAnswer(firstController.currentExercise));
    });

    expect(firstController.result?.isCorrect).toBe(false);
    expect(firstController.result?.xpEarned).toBeGreaterThan(0);
    expect(firstProgress.walletLessonRewards.claimedExerciseIds).toContain(exerciseId);
    expect(firstProgress.walletLessonProgress[exerciseId]).toEqual({
      passed: false,
      completedAt: firstProgress.walletLessonProgress[exerciseId]?.completedAt,
    });

    const savedTrainingCalls = storage.setItem.mock.calls.filter(([key]) => key === '@trainrekt/training-progress');
    const saved = savedTrainingCalls[savedTrainingCalls.length - 1]?.[1];
    expect(typeof saved).toBe('string');
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? (saved as string) : null));

    let retryController!: ScenarioController;
    function RetryHarness() {
      retryController = useTrainingScenario('practice', { source: 'wallet', topic: 'token-account-state', initialExerciseId: exerciseId });
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><RetryHarness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    act(() => {
      retryController.submitAnswer(getCorrectAnswer(retryController.currentExercise));
    });

    expect(retryController.result?.isCorrect).toBe(true);
    expect(retryController.result?.xpEarned).toBe(0);
  });

  it('keeps wallet retry XP at zero even after the original attempt is evicted from recent history', async () => {
    const exerciseId = 'wallet-lesson-frozen-account-state';
    const filledHistory = Array.from({ length: 10 }, (_, index) => ({
      id: `history-${index}`,
      scenarioId: `other-exercise-${index}`,
      scenarioTitle: `Other Exercise ${index}`,
      correct: true,
      skill: 'riskManagement' as const,
      timestamp: `2026-09-10T08:00:${String(index).padStart(2, '0')}.000Z`,
      xpEarned: 25,
      exerciseType: 'decision' as const,
    }));
    const seededProgress = {
      ...mockProgress,
      totalXp: 250,
      recentTrainingHistory: filledHistory,
      walletLessonRewards: { claimedExerciseIds: [exerciseId] },
      walletLessonProgress: {
        [exerciseId]: {
          passed: false,
          completedAt: '2026-09-11T09:00:00.000Z',
        },
      },
    };
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? JSON.stringify({ version: 4, data: seededProgress }) : null));

    let controller!: ScenarioController;
    let progress!: TrainingProgressSnapshot;
    function Harness() {
      controller = useTrainingScenario('practice', { source: 'wallet', topic: 'token-account-state', initialExerciseId: exerciseId });
      progress = useTrainingProgress().progress;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><Harness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    act(() => {
      controller.submitAnswer(getCorrectAnswer(controller.currentExercise));
    });

    expect(controller.result?.xpEarned).toBe(0);
    expect(progress.walletLessonRewards.claimedExerciseIds).toContain(exerciseId);
    expect(progress.walletLessonProgress[exerciseId]?.passed).toBe(true);
    expect(progress.recentTrainingHistory).toHaveLength(10);
  });

  it('grants one-time wallet reward independently per stable exercise ID', async () => {
    const seededProgress = {
      ...mockProgress,
      totalXp: 30,
      recentTrainingHistory: [],
      walletLessonRewards: { claimedExerciseIds: ['wallet-lesson-frozen-account-state'] },
      walletLessonProgress: {
        'wallet-lesson-frozen-account-state': {
          passed: true,
          completedAt: '2026-09-11T09:00:00.000Z',
        },
      },
      daily: { ...mockProgress.daily, todayCompletedDecisions: 0, dailyGoalCompleted: false },
    };
    storage.getItem.mockImplementation((key: string) => Promise.resolve(key === '@trainrekt/training-progress' ? JSON.stringify({ version: 4, data: seededProgress }) : null));

    let controller!: ScenarioController;
    let progress!: TrainingProgressSnapshot;
    function Harness() {
      controller = useTrainingScenario('practice', { source: 'wallet', topic: 'empty-token-account', initialExerciseId: 'wallet-lesson-empty-token-account-context' });
      progress = useTrainingProgress().progress;
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><SettingsProvider><Harness /></SettingsProvider></TrainingProgressProvider>);
      await Promise.resolve();
    });

    const expectedXp = Math.round(controller.currentExercise.xpReward * 0.25);
    const initialXp = progress.totalXp;
    act(() => {
      controller.submitAnswer(getCorrectAnswer(controller.currentExercise));
    });

    expect(controller.result?.xpEarned).toBe(expectedXp);
    expect(progress.totalXp).toBe(initialXp + expectedXp);
    expect(progress.walletLessonRewards.claimedExerciseIds).toContain('wallet-lesson-empty-token-account-context');
    expect(progress.walletLessonProgress['wallet-lesson-empty-token-account-context']?.passed).toBe(true);
  });
});

function createInitialProgressLike() {
  return {
    ...mockProgress,
    totalXp: 0,
    sessionsCompleted: 0,
    correctDecisions: 0,
    wrongDecisions: 0,
    currentStreak: 0,
    bestStreak: 0,
    recentTrainingHistory: [],
    walletLessonRewards: { claimedExerciseIds: [] },
    walletLessonProgress: {},
    surpriseChallenges: { completed: {} },
    badges: { earned: {} },
    daily: {
      ...mockProgress.daily,
      todayCompletedDecisions: 0,
      dailyGoalCompleted: false,
      lastDailyCompletionDate: null,
      dailyTrainingStreak: 0,
      bestDailyTrainingStreak: 0,
    },
  };
}
