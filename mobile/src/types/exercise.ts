import { TrainingScenario } from './scenario';
import { SkillKey } from './progress';

export type ExerciseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type ExerciseType = 'decision' | 'signature-simulation';

export interface BaseTrainingExercise {
  id: string;
  title: string;
  skill: SkillKey;
  difficulty: ExerciseDifficulty;
  xpReward: number;
  description: string;
}

// A decision exercise is an existing market scenario tagged with its discriminant.
export interface DecisionExercise extends TrainingScenario {
  type: 'decision';
}

export type SignatureRequestType = 'message' | 'transaction' | 'authorization';
export type SignatureDecision = 'sign' | 'reject';

export interface SignatureRiskIndicator {
  label: string;
  detail: string;
  severity: 'danger' | 'caution' | 'info';
}

export type SimulatedRequestAction =
  | { kind: 'summary'; label: string }
  | { kind: 'instruction'; instruction: string; program?: string; details?: readonly string[] };

export interface SignatureSimulationExercise extends BaseTrainingExercise {
  type: 'signature-simulation';
  requestingApp: string;
  requestingDomain?: string;
  requestType: SignatureRequestType;
  displayedActions: SimulatedRequestAction[];
  riskIndicators: SignatureRiskIndicator[];
  safeIndicators?: string[];
  learningPoints: string[];
  expectedDecision: SignatureDecision;
  explanation: string;
}

export type TrainingExercise = DecisionExercise | SignatureSimulationExercise;

export interface TrainingExerciseResult {
  isCorrect: boolean;
  xpEarned: number;
  title: string;
  explanation: string;
  learningPoints?: string[];
  riskIndicators?: SignatureRiskIndicator[];
  safeIndicators?: string[];
}
