import { TrainingProgress } from '@/types/progress';

export const mockProgress: TrainingProgress = {
  totalXp: 6742,
  sessionsCompleted: 12,
  correctDecisions: 34,
  wrongDecisions: 25,
  currentStreak: 4,
  bestStreak: 6,
  skillScores: {
    riskManagement: 72,
    profitTaking: 65,
    fomoResistance: 48,
    positionSizing: 81,
    scamAwareness: 50,
    leverageRisk: 50,
    panicSelling: 50,
    marketInterpretation: 50,
  },
  recentTrainingHistory: [
    { id: 'history-sol-momentum-trap', scenarioId: 'sol-momentum-trap', scenarioTitle: 'SOL Momentum Trap', correct: true, skill: 'profitTaking', timestamp: '2026-09-10T08:00:00.000Z', xpEarned: 120 },
    { id: 'history-btc-panic-sell', scenarioId: 'btc-panic-sell', scenarioTitle: 'BTC Panic Sell', correct: false, skill: 'riskManagement', timestamp: '2026-09-09T08:00:00.000Z', xpEarned: 30 },
    { id: 'history-memecoin-fomo', scenarioId: 'memecoin-fomo', scenarioTitle: 'Memecoin FOMO', correct: true, skill: 'fomoResistance', timestamp: '2026-09-08T08:00:00.000Z', xpEarned: 100 },
  ],
};
