import { TrainingScenario } from '@/types/scenario';

export const mockScenarios: TrainingScenario[] = [
  {
    id: 'sol-momentum-trap',
    title: 'SOL Momentum Trap',
    difficulty: 'Intermediate',
    duration: '~2 min',
    reward: 120,
    market: 'SOL / USD',
    prompt: 'SOL has rallied 18% in four hours. Volume is increasing rapidly and social sentiment is extremely bullish. You entered at $178. Price is now $196.',
    question: 'What do you do?',
    metrics: [
      { label: 'Entry', value: '$178' },
      { label: 'Current', value: '$196', tone: 'positive' },
      { label: 'PnL', value: '+10.1%', tone: 'positive' },
      { label: 'RSI', value: '78', tone: 'negative' },
      { label: '24h volume', value: '+64%', tone: 'positive' },
      { label: 'Funding', value: '0.045%', tone: 'negative' },
    ],
    options: [
      { id: 'sell-all', label: 'SELL 100%' },
      { id: 'take-profit', label: 'TAKE 50% PROFIT' },
      { id: 'hold', label: 'HOLD' },
      { id: 'add-position', label: 'ADD TO POSITION' },
    ],
    correctDecision: 'take-profit',
    explanation: 'Momentum is strong, but RSI and funding indicate an overheated market. Taking partial profit reduces risk while preserving upside exposure.',
  },
];