import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockProgress } from '@/data/mockProgress';
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

    expect(parsed.version).toBe(2);
    expect(parsed.data.totalXp).toBe(mockProgress.totalXp);
    expect(parsed.data).not.toHaveProperty('level');
    expect(parsed.data).not.toHaveProperty('winRate');
    expect(parsed.data).not.toHaveProperty('xpIntoCurrentLevel');
  });

  it('falls back safely for missing or malformed progress', async () => {
    expect(deserializeTrainingProgress(null)).toBeNull();
    expect(deserializeTrainingProgress('{bad json')).toBeNull();
    storage.getItem.mockResolvedValue('{"version":99,"data":{}}');

    await expect(loadTrainingProgress()).resolves.toEqual(mockProgress);
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
    storage.getItem.mockResolvedValue(JSON.stringify({ version: 1, data: legacyData }));

    const loaded = await loadTrainingProgress();

    expect(loaded.totalXp).toBe(mockProgress.totalXp);
    expect(loaded.recentTrainingHistory).toEqual(mockProgress.recentTrainingHistory);
    expect(loaded.daily.dailyGoal).toBe(3);
    expect(loaded.daily.todayCompletedDecisions).toBe(0);
    expect(loaded.daily.dailyGoalCompleted).toBe(false);
  });

  it('round-trips daily training fields through save and load', async () => {
    const progressWithDailyProgress = { ...mockProgress, daily: { ...mockProgress.daily, todayCompletedDecisions: 2, dailyTrainingStreak: 3, bestDailyTrainingStreak: 5 } };
    storage.getItem.mockResolvedValue(serializeTrainingProgress(progressWithDailyProgress));

    await saveTrainingProgress(progressWithDailyProgress);

    await expect(loadTrainingProgress()).resolves.toEqual(progressWithDailyProgress);
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
