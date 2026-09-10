import { TrainingScenario } from './scenario';
import { SkillKey } from './progress';

export type ExerciseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type ExerciseType = 'decision' | 'signature-simulation' | 'transaction-inspection';

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
export type TransactionInspectionDecision = 'approve' | 'reject' | 'needs-review';

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

export interface TransactionAccountChange {
  account: string;
  change: 'authority-changed' | 'owner-changed' | 'delegate-set' | 'close-authority-changed' | 'data-write';
  detail: string;
}

export interface TransactionTokenTransfer {
  asset: string;
  amount: string;
  direction: 'in' | 'out';
  from: string;
  to: string;
  isNft?: boolean;
}

export interface TransactionProgramInvocation {
  program: string;
  verified: boolean;
  purpose?: string;
}

export interface TransactionInstructionSummary {
  program: string;
  action: string;
  details?: readonly string[];
}

export interface TransactionInspectionExercise extends BaseTrainingExercise {
  type: 'transaction-inspection';
  requestingApp?: string;
  requestingDomain?: string;
  transaction: {
    network: 'solana-mainnet' | 'solana-devnet';
    feeSol: number;
    accountChanges: TransactionAccountChange[];
    tokenTransfers: TransactionTokenTransfer[];
    programInvocations: TransactionProgramInvocation[];
    instructions: TransactionInstructionSummary[];
  };
  expectedDecision: TransactionInspectionDecision;
  explanation: string;
  learningPoints: string[];
  ruleToRemember?: string;
}

export type TrainingExercise = DecisionExercise | SignatureSimulationExercise | TransactionInspectionExercise;

export interface TransactionInspectionAnalysis {
  requestingApp?: string;
  requestingDomain?: string;
  network: 'solana-mainnet' | 'solana-devnet';
  feeSol: number;
  accountChanges: TransactionAccountChange[];
  tokenTransfers: TransactionTokenTransfer[];
  programInvocations: TransactionProgramInvocation[];
  instructions: TransactionInstructionSummary[];
  ruleToRemember?: string;
}

export interface TrainingExerciseResult {
  isCorrect: boolean;
  xpEarned: number;
  title: string;
  explanation: string;
  learningPoints?: string[];
  riskIndicators?: SignatureRiskIndicator[];
  safeIndicators?: string[];
  transactionInspection?: TransactionInspectionAnalysis;
}
