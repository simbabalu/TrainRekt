export interface SkillProgress {
  name: string;
  percentage: number;
}

export interface HistoryEntry {
  scenarioTitle: string;
  result: 'Correct' | 'Wrong';
  xpEarned: number;
}

export interface TrainingProgress {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  sessions: number;
  correctDecisions: number;
  wrongDecisions: number;
  winRate: number;
  bestStreak: number;
  skills: SkillProgress[];
  history: HistoryEntry[];
}