import { SkillKey } from '@/types/progress';

export type DecisionId =
  | 'sell-all'
  | 'take-profit'
  | 'hold'
  | 'add-position'
  | 'do-not-chase'
  | 'reduce-position-size'
  | 'avoid-leverage'
  | 'avoid-token'
  | 'assess-thesis'
  | 'wait-confirmation'
  | 'skip-trade';

export interface MarketContext {
  asset?: string;
  price?: string;
  entryPrice?: string;
  pnl?: string;
  rsi?: string;
  volumeChange?: string;
  fundingRate?: string;
  liquidity?: string;
  marketCap?: string;
  leverage?: string;
  socialSentiment?: string;
  holderConcentration?: string;
  liquidityLocked?: string;
  timeHorizon?: string;
  riskRewardRatio?: string;
}

export interface ScenarioOption {
  id: DecisionId;
  label: string;
}

export interface TrainingScenario {
  id: string;
  title: string;
  skill: SkillKey;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedDuration: string;
  xpReward: number;
  marketContext: MarketContext;
  description: string;
  question: string;
  options: ScenarioOption[];
  correctOptionId: DecisionId;
  explanation: string;
}

export interface DecisionResult {
  isCorrect: boolean;
  xpEarned: number;
  title: string;
  explanation: string;
}