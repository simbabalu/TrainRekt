import { TrainingScenario } from './scenario';
import { SkillKey } from './progress';

export type ExerciseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type ExerciseType = 'decision' | 'signature-simulation' | 'transaction-inspection' | 'permission-challenge' | 'scam-detection';

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
export type PermissionChallengeDecision = 'allow' | 'reject' | 'needs-review';
export type ScamDetectionDecision = 'safe' | 'suspicious' | 'scam';
export type PermissionType = 'connect-wallet' | 'sign-message' | 'sign-transaction' | 'session-authorization' | 'unknown';

export interface ScamDetectionSignal {
  label: string;
  detail: string;
}

export interface PermissionRequestItem {
  label: string;
  detail: string;
  required: boolean;
  scope: 'single-use' | 'session' | 'future-requests' | 'unknown';
}

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

export interface PermissionChallengeExercise extends BaseTrainingExercise {
  type: 'permission-challenge';
  request: {
    appName: string;
    displayedDomain?: string;
    requestedOrigin?: string;
    permissionType: PermissionType;
    permissions: PermissionRequestItem[];
    contextualFacts?: string[];
  };
  expectedDecision: PermissionChallengeDecision;
  postDecisionAnalysis: {
    riskSignals?: string[];
    reassuringSignals?: string[];
  };
  explanation: string;
  learningPoints: string[];
  ruleToRemember?: string;
}

export interface ScamDetectionExercise extends BaseTrainingExercise {
  type: 'scam-detection';
  scenario: {
    sourceType:
      | 'website'
      | 'message'
      | 'support-chat'
      | 'airdrop'
      | 'nft-claim'
      | 'wallet-warning'
      | 'social-post'
      | 'other';
    senderOrApp?: string;
    displayedDomain?: string;
    destinationDomain?: string;
    headline?: string;
    message?: string;
    neutralFacts: string[];
  };
  expectedDecision: ScamDetectionDecision;
  postDecisionAnalysis: {
    riskSignals?: ScamDetectionSignal[];
    reassuringSignals?: ScamDetectionSignal[];
  };
  explanation: string;
  learningPoints: string[];
  ruleToRemember?: string;
}

export type TrainingExercise =
  | DecisionExercise
  | SignatureSimulationExercise
  | TransactionInspectionExercise
  | PermissionChallengeExercise
  | ScamDetectionExercise;

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

export interface PermissionChallengeAnalysis {
  appName: string;
  displayedDomain?: string;
  requestedOrigin?: string;
  permissionType: PermissionType;
  permissions: PermissionRequestItem[];
  contextualFacts?: string[];
  riskSignals?: string[];
  reassuringSignals?: string[];
  ruleToRemember?: string;
}

export interface ScamDetectionAnalysis {
  sourceType: ScamDetectionExercise['scenario']['sourceType'];
  senderOrApp?: string;
  displayedDomain?: string;
  destinationDomain?: string;
  headline?: string;
  message?: string;
  neutralFacts: string[];
  riskSignals?: ScamDetectionSignal[];
  reassuringSignals?: ScamDetectionSignal[];
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
  permissionChallenge?: PermissionChallengeAnalysis;
  scamDetection?: ScamDetectionAnalysis;
}
