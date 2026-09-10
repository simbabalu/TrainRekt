import AsyncStorage from '@react-native-async-storage/async-storage';

import { mockProgress } from '@/data/mockProgress';
import { SkillKey, SkillScores, TrainingProgress } from '@/types/progress';
import { storageKeys, storageSchemaVersion } from './storageKeys';

interface StoredProgress {
  version: number;
  data: TrainingProgress;
}

const skillKeys: SkillKey[] = ['riskManagement', 'profitTaking', 'fomoResistance', 'positionSizing', 'scamAwareness', 'leverageRisk', 'panicSelling', 'marketInterpretation'];

export function serializeTrainingProgress(progress: TrainingProgress): string {
  const stored: StoredProgress = { version: storageSchemaVersion, data: progress };
  return JSON.stringify(stored);
}

export function deserializeTrainingProgress(value: string | null): TrainingProgress | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isStoredProgress(parsed)) return null;
    return parsed.data;
  } catch (error) {
    console.warn('[TrainRekt] Could not parse stored training progress.', error);
    return null;
  }
}

export async function loadTrainingProgress(): Promise<TrainingProgress> {
  try {
    const stored = deserializeTrainingProgress(await AsyncStorage.getItem(storageKeys.trainingProgress));
    return stored ?? mockProgress;
  } catch (error) {
    console.warn('[TrainRekt] Could not load training progress.', error);
    return mockProgress;
  }
}

export async function saveTrainingProgress(progress: TrainingProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKeys.trainingProgress, serializeTrainingProgress(progress));
  } catch (error) {
    console.warn('[TrainRekt] Could not save training progress.', error);
  }
}

export async function clearTrainingProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKeys.trainingProgress);
  } catch (error) {
    console.warn('[TrainRekt] Could not clear training progress.', error);
  }
}

function isStoredProgress(value: unknown): value is StoredProgress {
  if (!isRecord(value) || value.version !== storageSchemaVersion || !isRecord(value.data)) return false;
  const data = value.data;
  return isNonNegativeNumber(data.totalXp) && isNonNegativeNumber(data.sessionsCompleted) && isNonNegativeNumber(data.correctDecisions) && isNonNegativeNumber(data.wrongDecisions) && isNonNegativeNumber(data.currentStreak) && isNonNegativeNumber(data.bestStreak) && isSkillScores(data.skillScores) && isHistory(data.recentTrainingHistory);
}

function isSkillScores(value: unknown): value is SkillScores {
  if (!isRecord(value)) return false;
  return skillKeys.every((key) => isNumberBetween(value[key], 0, 100));
}

function isHistory(value: unknown): value is TrainingProgress['recentTrainingHistory'] {
  return Array.isArray(value) && value.length <= 10 && value.every((entry) => isRecord(entry) && typeof entry.id === 'string' && typeof entry.scenarioId === 'string' && typeof entry.scenarioTitle === 'string' && typeof entry.correct === 'boolean' && skillKeys.includes(entry.skill as SkillKey) && typeof entry.timestamp === 'string' && isNonNegativeNumber(entry.xpEarned));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNumberBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}