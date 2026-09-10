export type SkillKey =
  | 'riskManagement'
  | 'profitTaking'
  | 'fomoResistance'
  | 'positionSizing'
  | 'scamAwareness'
  | 'leverageRisk'
  | 'panicSelling'
  | 'marketInterpretation';

export type SkillScores = Record<SkillKey, number>;

export interface HistoryEntry {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  correct: boolean;
  skill: SkillKey;
  timestamp: string;
  xpEarned: number;
}

export interface TrainingProgress {
  totalXp: number;
  sessionsCompleted: number;
  correctDecisions: number;
  wrongDecisions: number;
  currentStreak: number;
  bestStreak: number;
  skillScores: SkillScores;
  recentTrainingHistory: HistoryEntry[];
}

export interface ProgressSummary {
  level: number;
  xpIntoCurrentLevel: number;
  xpRequiredForNextLevel: number;
  xpToNextLevel: number;
  winRate: number;
}

export type TrainingProgressSnapshot = TrainingProgress & ProgressSummary;