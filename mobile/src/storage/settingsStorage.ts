import AsyncStorage from '@react-native-async-storage/async-storage';

import { mockSettings } from '@/data/mockSettings';
import { difficultyOptions, TrainingSettings } from '@/types/settings';
import { storageKeys, storageSchemaVersion } from './storageKeys';

interface StoredSettings {
  version: number;
  data: TrainingSettings;
}

export function serializeSettings(settings: TrainingSettings): string {
  return JSON.stringify({ version: storageSchemaVersion, data: settings } satisfies StoredSettings);
}

export function deserializeSettings(value: string | null): TrainingSettings | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isStoredSettings(parsed)) return null;
    return parsed.data;
  } catch (error) {
    console.warn('[TrainRekt] Could not parse stored settings.', error);
    return null;
  }
}

export async function loadSettings(): Promise<TrainingSettings> {
  try {
    const stored = deserializeSettings(await AsyncStorage.getItem(storageKeys.settings));
    return stored ?? mockSettings;
  } catch (error) {
    console.warn('[TrainRekt] Could not load settings.', error);
    return mockSettings;
  }
}

export async function saveSettings(settings: TrainingSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKeys.settings, serializeSettings(settings));
  } catch (error) {
    console.warn('[TrainRekt] Could not save settings.', error);
  }
}

export async function clearSettings(): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKeys.settings);
  } catch (error) {
    console.warn('[TrainRekt] Could not clear settings.', error);
  }
}

function isStoredSettings(value: unknown): value is StoredSettings {
  if (!isRecord(value) || value.version !== storageSchemaVersion || !isRecord(value.data)) return false;
  const data = value.data;
  return difficultyOptions.includes(data.difficulty as TrainingSettings['difficulty']) && typeof data.notificationsEnabled === 'boolean' && typeof data.soundEffectsEnabled === 'boolean' && typeof data.hapticFeedbackEnabled === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}