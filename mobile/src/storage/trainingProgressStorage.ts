import AsyncStorage from '@react-native-async-storage/async-storage';

import { mockProgress } from '@/data/mockProgress';
import { createDefaultDailyTrainingState } from '@/domain/training/normalizeDailyTrainingState';
import { DailyTrainingState, SkillKey, SkillScores, TrainingProgress } from '@/types/progress';
import { storageKeys, storageSchemaVersion } from './storageKeys';

interface StoredProgress {
  version: number;
  data: Record<string, unknown>;
}

const skillKeys: SkillKey[] = ['riskManagement', 'profitTaking', 'fomoResistance', 'positionSizing', 'scamAwareness', 'leverageRisk', 'panicSelling', 'marketInterpretation', 'walletSafety'];
const defaultSkillScore = 50;

export function serializeTrainingProgress(progress: TrainingProgress): string {
  return JSON.stringify({ version: storageSchemaVersion, data: progress });
}

export function deserializeTrainingProgress(value: string | null): TrainingProgress | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isStoredEnvelope(parsed) || !isValidBaseProgress(parsed.data)) return null;
    const base = parsed.data as unknown as TrainingProgress;
    return { ...base, skillScores: normalizeStoredSkillScores(parsed.data.skillScores), daily: normalizeStoredDaily(parsed.data.daily) };
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

function isStoredEnvelope(value: unknown): value is StoredProgress {
  return isRecord(value) && typeof value.version === 'number' && isRecord(value.data);
}

function isValidBaseProgress(data: Record<string, unknown>): boolean {
  return isNonNegativeNumber(data.totalXp) && isNonNegativeNumber(data.sessionsCompleted) && isNonNegativeNumber(data.correctDecisions) && isNonNegativeNumber(data.wrongDecisions) && isNonNegativeNumber(data.currentStreak) && isNonNegativeNumber(data.bestStreak) && isRecord(data.skillScores) && isHistory(data.recentTrainingHistory);
}

function normalizeStoredDaily(value: unknown): DailyTrainingState {
  return isValidDailyState(value) ? value : createDefaultDailyTrainingState();
}

// Backfills any skill missing from legacy saves (e.g. a newly introduced skill) without discarding the rest of the progress.
function normalizeStoredSkillScores(value: unknown): SkillScores {
  const source = isRecord(value) ? value : {};
  const normalized = {} as SkillScores;
  skillKeys.forEach((key) => {
    normalized[key] = isNumberBetween(source[key], 0, 100) ? (source[key] as number) : defaultSkillScore;
  });
  return normalized;
}

function isValidDailyState(value: unknown): value is DailyTrainingState {
  if (!isRecord(value)) return false;
  return isNonNegativeNumber(value.dailyGoal) && isNonNegativeNumber(value.todayCompletedDecisions) && typeof value.todayDateKey === 'string' && typeof value.dailyGoalCompleted === 'boolean' && (value.lastDailyCompletionDate === null || typeof value.lastDailyCompletionDate === 'string') && isNonNegativeNumber(value.dailyTrainingStreak) && isNonNegativeNumber(value.bestDailyTrainingStreak);
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