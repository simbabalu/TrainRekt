import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockProgress } from '@/data/mockProgress';
import { createInitialTrainingProgress } from '@/domain/progress/createInitialTrainingProgress';
import { mockSettings } from '@/data/mockSettings';
import {
  deserializeTrainingProgress,
  loadTrainingProgress,
  saveTrainingProgress,
  clearTrainingProgress,
  serializeTrainingProgress,
} from './trainingProgressStorage';
import { deserializeSettings, loadSettings, saveSettings, clearSettings, serializeSettings } from './settingsStorage';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

beforeEach(() => {
  vi.clearAllMocks();
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue(undefined);
  storage.removeItem.mockResolvedValue(undefined);
});

describe('training progress storage', () => {
  it('serializes authoritative progress without derived values', () => {
    const parsed = JSON.parse(serializeTrainingProgress(mockProgress)) as { version: number; data: Record<string, unknown> };

    expect(parsed.version).toBe(4);
    expect(parsed.data.totalXp).toBe(mockProgress.totalXp);
    expect(parsed.data).not.toHaveProperty('level');
    expect(parsed.data).not.toHaveProperty('winRate');
    expect(parsed.data).not.toHaveProperty('xpIntoCurrentLevel');
  });

  it('falls back safely for missing or malformed progress', async () => {
    expect(deserializeTrainingProgress(null)).toBeNull();
    expect(deserializeTrainingProgress('{bad json')).toBeNull();
    storage.getItem.mockResolvedValue('{"version":99,"data":{}}');

    await expect(loadTrainingProgress()).resolves.toEqual(createInitialTrainingProgress());
  });

  it('persists, hydrates, and clears progress through AsyncStorage', async () => {
    const serialized = serializeTrainingProgress(mockProgress);
    storage.getItem.mockResolvedValue(serialized);

    await saveTrainingProgress(mockProgress);
    await expect(loadTrainingProgress()).resolves.toEqual(mockProgress);
    await clearTrainingProgress();

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
  });

  it('hydrates legacy persisted progress without daily fields using safe defaults', async () => {
    const legacyData: Record<string, unknown> = { ...mockProgress };
    delete legacyData.daily;
    delete legacyData.surpriseChallenges;
    delete legacyData.badges;
    delete legacyData.walletLessonRewards;
    delete legacyData.walletLessonProgress;
    storage.getItem.mockResolvedValue(JSON.stringify({ version: 1, data: legacyData }));

    const loaded = await loadTrainingProgress();

    expect(loaded.totalXp).toBe(mockProgress.totalXp);
    expect(loaded.recentTrainingHistory).toEqual(mockProgress.recentTrainingHistory);
    expect(loaded.walletLessonRewards).toEqual({ claimedExerciseIds: [] });
    expect(loaded.walletLessonProgress).toEqual({});
    expect(loaded.daily.dailyGoal).toBe(3);
    expect(loaded.daily.todayCompletedDecisions).toBe(0);
    expect(loaded.daily.dailyGoalCompleted).toBe(false);
    expect(loaded.surpriseChallenges.completed).toEqual({});
    expect(loaded.badges.earned).toEqual({});
  });

  it('round-trips daily training fields through save and load', async () => {
    const progressWithDailyProgress = {
      ...mockProgress,
      daily: { ...mockProgress.daily, todayCompletedDecisions: 2, dailyTrainingStreak: 3, bestDailyTrainingStreak: 5 },
      surpriseChallenges: {
        completed: {
          'surprise-airdrop-001': {
            challengeVersion: 1,
            completedAt: '2026-09-11T08:00:00.000Z',
            firstDecision: 'inspect' as const,
            finalDecision: 'reject' as const,
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
    };
    storage.getItem.mockResolvedValue(serializeTrainingProgress(progressWithDailyProgress));

    await saveTrainingProgress(progressWithDailyProgress);

    await expect(loadTrainingProgress()).resolves.toEqual(progressWithDailyProgress);
  });

  it('normalizes wallet lesson reward claims from persisted progress', async () => {
    const persisted = {
      ...mockProgress,
      walletLessonRewards: {
        claimedExerciseIds: ['wallet-lesson-frozen-account-state', 42, 'wallet-lesson-frozen-account-state'],
      },
    };
    storage.getItem.mockResolvedValue(JSON.stringify({ version: 4, data: persisted }));

    const loaded = await loadTrainingProgress();

    expect(loaded.walletLessonRewards).toEqual({ claimedExerciseIds: ['wallet-lesson-frozen-account-state'] });
  });

  it('hydrates persisted wallet lesson progress and removes unknown entries', async () => {
    const persisted = {
      ...mockProgress,
      walletLessonProgress: {
        'wallet-lesson-frozen-account-state': {
          passed: true,
          completedAt: '2026-09-11T10:00:00.000Z',
        },
        'not-a-wallet-lesson': {
          passed: false,
          completedAt: '2026-09-11T10:00:00.000Z',
        },
      },
    };
    storage.getItem.mockResolvedValue(JSON.stringify({ version: 4, data: persisted }));

    const loaded = await loadTrainingProgress();

    expect(loaded.walletLessonProgress).toEqual({
      'wallet-lesson-frozen-account-state': {
        passed: true,
        completedAt: '2026-09-11T10:00:00.000Z',
      },
    });
  });

  it('persists and restores PASSED/FAILED wallet lesson outcomes across restarts', async () => {
    const persisted = {
      ...mockProgress,
      walletLessonProgress: {
        'wallet-lesson-frozen-account-state': {
          passed: true,
          completedAt: '2026-09-11T10:00:00.000Z',
        },
        'wallet-lesson-empty-token-account-context': {
          passed: false,
          completedAt: '2026-09-11T11:00:00.000Z',
        },
      },
    };
    storage.getItem.mockResolvedValue(JSON.stringify({ version: 4, data: persisted }));

    const loaded = await loadTrainingProgress();

    expect(loaded.walletLessonProgress).toEqual({
      'wallet-lesson-frozen-account-state': {
        passed: true,
        completedAt: '2026-09-11T10:00:00.000Z',
      },
      'wallet-lesson-empty-token-account-context': {
        passed: false,
        completedAt: '2026-09-11T11:00:00.000Z',
      },
    });
  });

  it('migrates wallet lesson progress from deterministic history when progress map is missing', async () => {
    const persisted = {
      ...mockProgress,
      recentTrainingHistory: [
        {
          id: 'history-1',
          scenarioId: 'wallet-lesson-frozen-account-state',
          scenarioTitle: 'Token Account State',
          correct: false,
          skill: 'walletSafety' as const,
          timestamp: '2026-09-11T09:00:00.000Z',
          xpEarned: 8,
          exerciseType: 'transaction-inspection' as const,
        },
        {
          id: 'history-2',
          scenarioId: 'wallet-lesson-frozen-account-state',
          scenarioTitle: 'Token Account State',
          correct: true,
          skill: 'walletSafety' as const,
          timestamp: '2026-09-11T10:00:00.000Z',
          xpEarned: 0,
          exerciseType: 'transaction-inspection' as const,
        },
        {
          id: 'history-3',
          scenarioId: 'sol-momentum-trap',
          scenarioTitle: 'SOL Momentum Trap',
          correct: true,
          skill: 'profitTaking' as const,
          timestamp: '2026-09-11T11:00:00.000Z',
          xpEarned: 120,
          exerciseType: 'decision' as const,
        },
      ],
      walletLessonRewards: { claimedExerciseIds: ['wallet-lesson-frozen-account-state'] },
    };
    delete (persisted as { walletLessonProgress?: unknown }).walletLessonProgress;
    storage.getItem.mockResolvedValue(JSON.stringify({ version: 3, data: persisted }));

    const loaded = await loadTrainingProgress();

    expect(loaded.walletLessonRewards.claimedExerciseIds).toEqual(['wallet-lesson-frozen-account-state']);
    expect(loaded.walletLessonProgress).toEqual({
      'wallet-lesson-frozen-account-state': {
        passed: true,
        completedAt: '2026-09-11T10:00:00.000Z',
      },
    });
  });
});

describe('settings storage', () => {
  it('serializes and hydrates settings with schema versioning', async () => {
    storage.getItem.mockResolvedValue(serializeSettings(mockSettings));

    await saveSettings(mockSettings);
    await expect(loadSettings()).resolves.toEqual(mockSettings);
    expect(deserializeSettings('{"version":1,"data":{"difficulty":"Unknown"}}')).toBeNull();
  });

  it('falls back to defaults and clears persisted settings', async () => {
    storage.getItem.mockResolvedValue('{bad json');

    await expect(loadSettings()).resolves.toEqual(mockSettings);
    await clearSettings();

    expect(storage.removeItem).toHaveBeenCalledTimes(1);
  });
});
