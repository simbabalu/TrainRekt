import { TrainingProgress } from '@/types/progress';

export const mockProgress: TrainingProgress = {
  level: 7,
  currentXp: 742,
  nextLevelXp: 1000,
  sessions: 12,
  correctDecisions: 34,
  wrongDecisions: 25,
  winRate: 58,
  bestStreak: 6,
  skills: [
    { name: 'Risk Management', percentage: 72 },
    { name: 'Profit Taking', percentage: 65 },
    { name: 'FOMO Resistance', percentage: 48 },
    { name: 'Position Sizing', percentage: 81 },
  ],
  history: [
    { scenarioTitle: 'SOL Momentum Trap', result: 'Correct', xpEarned: 120 },
    { scenarioTitle: 'BTC Panic Sell', result: 'Wrong', xpEarned: 30 },
    { scenarioTitle: 'Memecoin FOMO', result: 'Correct', xpEarned: 100 },
  ],
};