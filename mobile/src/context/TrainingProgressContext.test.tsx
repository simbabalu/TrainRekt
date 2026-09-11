import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockProgress } from '@/data/mockProgress';
import { exerciseCatalog } from '@/data/exerciseCatalog';
import { demoPreparationPolicy } from '@/domain/training/demoPreparationPolicy';
import { createInitialTrainingProgress } from '@/domain/progress/createInitialTrainingProgress';
import { TrainingProgressProvider } from './TrainingProgressContext';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

const storageMock = vi.hoisted(() => ({
  loadTrainingProgress: vi.fn(),
  saveTrainingProgress: vi.fn().mockResolvedValue(undefined),
  clearTrainingProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/storage/trainingProgressStorage', () => storageMock);

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.saveTrainingProgress.mockResolvedValue(undefined);
  storageMock.clearTrainingProgress.mockResolvedValue(undefined);
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
});

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

  it('resets daily training state when resetting progress', async () => {
    storageMock.loadTrainingProgress.mockResolvedValue({
      ...mockProgress,
      daily: { ...mockProgress.daily, todayCompletedDecisions: 2, dailyGoalCompleted: false, dailyTrainingStreak: 4, bestDailyTrainingStreak: 6 },
    });
    let context!: ReturnType<typeof useTrainingProgress>;

    function Harness() {
      context = useTrainingProgress();
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><Harness /></TrainingProgressProvider>);
    });

    expect(context.progress.daily.todayCompletedDecisions).toBe(2);

    await act(async () => {
      await context.resetProgress();
    });

    expect(context.progress.daily.todayCompletedDecisions).toBe(0);
    expect(context.progress.daily.dailyGoalCompleted).toBe(false);
    expect(context.progress.daily.dailyTrainingStreak).toBe(0);
    expect(context.progress.daily.bestDailyTrainingStreak).toBe(0);
  });

  it('starts clean and updates derived XP progress immediately after an award', async () => {
    storageMock.loadTrainingProgress.mockResolvedValue(createInitialTrainingProgress());
    let context!: ReturnType<typeof useTrainingProgress>;

    function Harness() {
      context = useTrainingProgress();
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><Harness /></TrainingProgressProvider>);
    });

    expect(context.progress.totalXp).toBe(0);
    expect(context.progress.level).toBe(1);
    expect(context.progress.progressPercentage).toBe(0);

    await act(async () => {
      context.recordTrainingResult(exerciseCatalog[0], {
        isCorrect: true,
        xpEarned: 120,
        title: 'Correct',
        explanation: 'Correct decision.',
      }, 'practice');
    });

    expect(context.progress.totalXp).toBe(120);
    expect(context.progress.xpIntoCurrentLevel).toBe(120);
    expect(context.progress.progressPercentage).toBe(12);
    expect(context.progress.xpToNextLevel).toBe(880);
  });

  it('resets all training fields to the canonical state and clears persisted training data', async () => {
    storageMock.loadTrainingProgress.mockResolvedValue({
      ...mockProgress,
      daily: { ...mockProgress.daily, todayCompletedDecisions: 2, dailyTrainingStreak: 4, bestDailyTrainingStreak: 6 },
    });
    let context!: ReturnType<typeof useTrainingProgress>;

    function Harness() {
      context = useTrainingProgress();
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><Harness /></TrainingProgressProvider>);
    });

    await act(async () => {
      await context.resetProgress();
    });

    expect(context.progress.totalXp).toBe(0);
    expect(context.progress.sessionsCompleted).toBe(0);
    expect(context.progress.correctDecisions).toBe(0);
    expect(context.progress.wrongDecisions).toBe(0);
    expect(context.progress.currentStreak).toBe(0);
    expect(context.progress.bestStreak).toBe(0);
    expect(context.progress.recentTrainingHistory).toEqual([]);
    expect(context.progress.walletLessonRewards.claimedExerciseIds).toEqual([]);
    expect(context.progress.walletLessonProgress).toEqual({});
    expect(Object.values(context.progress.skillScores)).toEqual(Array(9).fill(50));
    expect(context.progress.daily.dailyGoal).toBe(3);
    expect(context.progress.daily.todayCompletedDecisions).toBe(0);
    expect(context.progress.daily.dailyGoalCompleted).toBe(false);
    expect(context.progress.daily.lastDailyCompletionDate).toBeNull();
    expect(context.progress.daily.dailyTrainingStreak).toBe(0);
    expect(context.progress.daily.bestDailyTrainingStreak).toBe(0);
    expect(context.progress.surpriseChallenges.completed).toEqual({});
    expect(context.progress.badges.earned).toEqual({});
    expect(storageMock.clearTrainingProgress).toHaveBeenCalledTimes(1);
  });

  it('prepareDemo uses canonical fresh progress reset and queues one deterministic daily exercise in DEV', async () => {
    storageMock.loadTrainingProgress.mockResolvedValue({
      ...mockProgress,
      totalXp: 999,
      sessionsCompleted: 22,
      correctDecisions: 10,
      wrongDecisions: 12,
      currentStreak: 5,
      bestStreak: 8,
      recentTrainingHistory: [mockProgress.recentTrainingHistory[0]],
      walletLessonRewards: { claimedExerciseIds: ['wallet-lesson-frozen-account-state'] },
      walletLessonProgress: {
        'wallet-lesson-frozen-account-state': { passed: false, completedAt: '2026-09-11T08:00:00.000Z' },
      },
      surpriseChallenges: {
        completed: {
          'surprise-airdrop-001': {
            challengeVersion: 1,
            completedAt: '2026-09-11T08:00:00.000Z',
            firstDecision: 'inspect',
            finalDecision: 'reject',
            xpAwarded: 250,
            badgeEarned: true,
          },
        },
      },
      badges: {
        earned: {
          'airdrop-survivor': {
            earnedAt: '2026-09-11T08:00:00.000Z',
            sourceChallengeId: 'surprise-airdrop-001',
            sourceChallengeVersion: 1,
          },
        },
      },
      daily: {
        ...mockProgress.daily,
        todayCompletedDecisions: 2,
        dailyGoalCompleted: true,
        lastDailyCompletionDate: '2026-09-11',
        dailyTrainingStreak: 3,
        bestDailyTrainingStreak: 4,
      },
    });

    let context!: ReturnType<typeof useTrainingProgress>;

    function Harness() {
      context = useTrainingProgress();
      return null;
    }

    await act(async () => {
      create(<TrainingProgressProvider><Harness /></TrainingProgressProvider>);
    });

    expect(context.consumePreparedDemoExerciseId()).toBeNull();

    await act(async () => {
      await context.prepareDemo();
    });

    expect(context.progress.totalXp).toBe(0);
    expect(context.progress.sessionsCompleted).toBe(0);
    expect(context.progress.correctDecisions).toBe(0);
    expect(context.progress.wrongDecisions).toBe(0);
    expect(context.progress.currentStreak).toBe(0);
    expect(context.progress.bestStreak).toBe(0);
    expect(context.progress.recentTrainingHistory).toEqual([]);
    expect(context.progress.walletLessonRewards.claimedExerciseIds).toEqual([]);
    expect(context.progress.walletLessonProgress).toEqual({});
    expect(context.progress.daily.dailyGoal).toBe(3);
    expect(context.progress.daily.todayCompletedDecisions).toBe(0);
    expect(context.progress.daily.dailyGoalCompleted).toBe(false);
    expect(context.progress.daily.dailyTrainingStreak).toBe(0);
    expect(context.progress.daily.bestDailyTrainingStreak).toBe(0);
    expect(context.progress.daily.lastDailyCompletionDate).toBeNull();
    expect(context.progress.level).toBe(1);
    expect(context.progress.surpriseChallenges.completed).toEqual({});
    expect(context.progress.badges.earned).toEqual({});
    expect(context.consumePreparedDemoExerciseId()).toBe(demoPreparationPolicy.firstDailyExerciseId);
    expect(context.consumePreparedDemoExerciseId()).toBeNull();
    expect(storageMock.clearTrainingProgress).toHaveBeenCalledTimes(1);
  });
});
