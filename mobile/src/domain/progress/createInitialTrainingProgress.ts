import { createDefaultDailyTrainingState } from '@/domain/training/normalizeDailyTrainingState';
import type { SkillScores, TrainingProgress } from '@/types/progress';

const skillKeys: (keyof SkillScores)[] = [
  'riskManagement',
  'profitTaking',
  'fomoResistance',
  'positionSizing',
  'scamAwareness',
  'leverageRisk',
  'panicSelling',
  'marketInterpretation',
  'walletSafety',
];

export function createInitialTrainingProgress(): TrainingProgress {
  const skillScores = {} as SkillScores;
  for (const skill of skillKeys) skillScores[skill] = 50;

  return {
    totalXp: 0,
    sessionsCompleted: 0,
    correctDecisions: 0,
    wrongDecisions: 0,
    currentStreak: 0,
    bestStreak: 0,
    skillScores,
    recentTrainingHistory: [],
    walletLessonRewards: { claimedExerciseIds: [] },
    walletLessonProgress: {},
    daily: createDefaultDailyTrainingState(),
    surpriseChallenges: { completed: {} },
    badges: { earned: {} },
  };
}