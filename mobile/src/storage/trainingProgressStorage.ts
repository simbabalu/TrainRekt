import AsyncStorage from '@react-native-async-storage/async-storage';

import { createInitialTrainingProgress } from '@/domain/progress/createInitialTrainingProgress';
import { createDefaultDailyTrainingState } from '@/domain/training/normalizeDailyTrainingState';
import { DailyTrainingState, SkillKey, SkillScores, TrainingProgress } from '@/types/progress';
import { BadgeProgress, SurpriseChallengeDecision, SurpriseChallengeFinalDecision, SurpriseChallengeProgress } from '@/types/surpriseChallenge';
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
    return {
      ...base,
      skillScores: normalizeStoredSkillScores(parsed.data.skillScores),
      daily: normalizeStoredDaily(parsed.data.daily),
      surpriseChallenges: normalizeStoredSurpriseChallenges(parsed.data.surpriseChallenges),
      badges: normalizeStoredBadges(parsed.data.badges),
    };
  } catch (error) {
    console.warn('[TrainRekt] Could not parse stored training progress.', error);
    return null;
  }
}

export async function loadTrainingProgress(): Promise<TrainingProgress> {
  try {
    const stored = deserializeTrainingProgress(await AsyncStorage.getItem(storageKeys.trainingProgress));
    return stored ?? createInitialTrainingProgress();
  } catch (error) {
    console.warn('[TrainRekt] Could not load training progress.', error);
    return createInitialTrainingProgress();
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

function normalizeStoredSurpriseChallenges(value: unknown): SurpriseChallengeProgress {
  if (!isRecord(value) || !isRecord(value.completed)) return { completed: {} };
  const completed: SurpriseChallengeProgress['completed'] = {};
  Object.entries(value.completed).forEach(([challengeId, record]) => {
    if (!isValidStoredSurpriseCompletionRecord(record)) return;
    completed[challengeId] = {
      challengeVersion: record.challengeVersion,
      completedAt: record.completedAt,
      firstDecision: record.firstDecision,
      finalDecision: record.finalDecision,
      xpAwarded: record.xpAwarded,
      badgeEarned: record.badgeEarned,
    };
  });
  return { completed };
}

function normalizeStoredBadges(value: unknown): BadgeProgress {
  if (!isRecord(value) || !isRecord(value.earned)) return { earned: {} };
  const earned: BadgeProgress['earned'] = {};
  Object.entries(value.earned).forEach(([badgeId, record]) => {
    if (!isRecord(record)) return;
    if (
      typeof record.earnedAt !== 'string'
      || typeof record.sourceChallengeId !== 'string'
      || !isNonNegativeNumber(record.sourceChallengeVersion)
    ) {
      return;
    }
    earned[badgeId] = {
      earnedAt: record.earnedAt,
      sourceChallengeId: record.sourceChallengeId,
      sourceChallengeVersion: record.sourceChallengeVersion,
    };
  });
  return { earned };
}

function isValidStoredSurpriseCompletionRecord(value: unknown): value is {
  challengeVersion: number;
  completedAt: string;
  firstDecision: SurpriseChallengeDecision;
  finalDecision: SurpriseChallengeFinalDecision;
  xpAwarded: number;
  badgeEarned: boolean;
} {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeNumber(value.challengeVersion)
    && typeof value.completedAt === 'string'
    && isSurpriseChallengeDecision(value.firstDecision)
    && isSurpriseChallengeFinalDecision(value.finalDecision)
    && isNonNegativeNumber(value.xpAwarded)
    && typeof value.badgeEarned === 'boolean'
  );
}

function isSurpriseChallengeDecision(value: unknown): value is SurpriseChallengeDecision {
  return value === 'sign' || value === 'inspect' || value === 'reject';
}

function isSurpriseChallengeFinalDecision(value: unknown): value is SurpriseChallengeFinalDecision {
  return value === 'sign' || value === 'reject';
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