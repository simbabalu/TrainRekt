import { SkillKey } from '@/types/progress';
import { ExerciseType } from '@/types/exercise';

export const skillLabels: Record<SkillKey, string> = {
  riskManagement: 'Risk Management',
  profitTaking: 'Profit Taking',
  fomoResistance: 'FOMO Resistance',
  positionSizing: 'Position Sizing',
  scamAwareness: 'Scam Awareness',
  leverageRisk: 'Leverage Risk',
  panicSelling: 'Panic Selling',
  marketInterpretation: 'Market Interpretation',
  walletSafety: 'Wallet Safety',
};

export const exerciseTypeLabels: Record<ExerciseType, string> = {
  decision: 'MARKET DECISION',
  'signature-simulation': 'WALLET SAFETY',
};