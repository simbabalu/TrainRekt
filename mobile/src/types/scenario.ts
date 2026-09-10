import { SkillKey } from '@/types/progress';

export type DecisionId = 'sell-all' | 'take-profit' | 'hold' | 'add-position';

export interface MarketMetric {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface ScenarioOption {
  id: DecisionId;
  label: string;
}

export interface TrainingScenario {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  reward: number;
  skill: SkillKey;
  market: string;
  prompt: string;
  question: string;
  metrics: MarketMetric[];
  options: ScenarioOption[];
  correctDecision: DecisionId;
  explanation: string;
}

export interface DecisionResult {
  isCorrect: boolean;
  xpEarned: number;
  title: string;
  explanation: string;
}