import type { WalletTrainingTopic } from '@/types/walletTraining';

export interface TokenInspectionApiRequest {
  mint: string;
}

export interface TokenInspectionIdentity {
  mint: string;
  name: string | null;
  symbol: string | null;
  metadataUri?: string | null;
  logoUri?: string | null;
}

export interface TokenInspectionAuthorities {
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  mintAuthority: string | null;
  freezeAuthority: string | null;
}

export interface TokenInspectionProgramInfo {
  programId: string;
  programType: string;
}

export interface TokenInspectionAge {
  ageSeconds: number | null;
  isReliable: boolean;
  unavailableReason: string | null;
}

export interface TokenInspectionUnclassifiedConcentration {
  classifiedProtocolPercentage: number | null;
  unknownPercentageWithinReportedLargestAccounts: number | null;
  largestUnknownTokenAccountPercentage: number | null;
  top5UnknownTokenAccountsPercentage: number | null;
  semanticsNote: string | null;
}

export interface TokenInspectionHolderConcentration {
  topHolderPercentage: number | null;
  top5HoldersPercentage: number | null;
  top10HoldersPercentage: number | null;
  semanticsNote: string;
  unclassifiedTokenAccountConcentration: TokenInspectionUnclassifiedConcentration | null;
}

export interface TokenInspectionAccountClassification {
  classification: string;
  protocol: string | null;
  confidence: string;
}

export interface TokenInspectionLargestAccount {
  address: string;
  percentage: number | null;
  classification: TokenInspectionAccountClassification;
}

export interface TokenInspectionPumpFunContext {
  protocol: string;
  bondingCurveDetected: boolean;
  bondingCurveAddress: string | null;
  bondingCurveTokenAccount: string | null;
  complete: boolean | null;
}

export interface TokenInspectionObservedFactReference {
  factId: string;
  observedValue: string | null;
  expectedValue: string | null;
  note: string | null;
}

export interface TokenInspectionProtocolSource {
  id: string;
  sourceType: string;
  title: string;
  publisher: string;
  url: string;
  retrievedAtUtc: string | null;
  publishedAtUtc: string | null;
}

export interface TokenInspectionDocumentedClaim {
  id: string;
  category: string;
  statement: string;
  verificationStatus: string;
  verificationMethod: string;
  sourceIds: string[];
  observedFactReferences: TokenInspectionObservedFactReference[];
  verificationNote: string | null;
  consistency: string;
}

export interface TokenInspectionProtocolContext {
  protocol: string;
  sources: TokenInspectionProtocolSource[];
  claims: TokenInspectionDocumentedClaim[];
}

export interface TokenInspectionReviewSignal {
  id: string;
  category: string;
  severity: string;
  explanation: string;
  evidence: Record<string, string>;
}

export type TokenInspectionResearchAvailability =
  | 'complete'
  | 'partial'
  | 'unavailable'
  | 'not-attempted';

export type TokenInspectionResearchFailureCategory =
  | 'timeout'
  | 'cancelled'
  | 'provider-unavailable'
  | 'network-failure'
  | 'invalid-provider-response'
  | 'rate-limited'
  | 'provider-rejected'
  | 'disabled'
  | 'missing-api-key'
  | 'unknown';

export interface TokenInspectionResearchStatus {
  availability: TokenInspectionResearchAvailability;
  failureCategory: TokenInspectionResearchFailureCategory | null;
  failureStage: string | null;
  message: string | null;
}

export interface TokenInspectionResponse {
  identity: TokenInspectionIdentity;
  authorities: TokenInspectionAuthorities;
  program: TokenInspectionProgramInfo;
  age: TokenInspectionAge;
  holderConcentration: TokenInspectionHolderConcentration;
  largestTokenAccounts: TokenInspectionLargestAccount[];
  pumpFunContext?: TokenInspectionPumpFunContext | null;
  protocolContext?: TokenInspectionProtocolContext | null;
  researchStatus?: TokenInspectionResearchStatus | null;
  reviewSignals: TokenInspectionReviewSignal[];
  inspectedAtUtc: string;
}

export interface TokenIdentityCollisionResponse {
  candidateMint: string;
  rawName: string | null;
  rawSymbol: string | null;
  matchDimensions: string[];
  matchLevel: string;
  firstObservedAtUtc: string;
  lastObservedAtUtc: string;
}

export interface TokenIdentityEvidenceResponse {
  id: string;
  detail: string;
}

export interface OnChainChronologyResponse {
  earliestObservedSignature: string | null;
  earliestObservedSlot: number | null;
  earliestObservedBlockTimeUtc: string | null;
  historyCoverage: string;
  paginationExhausted: boolean;
  pagesScanned: number;
  signaturesScanned: number;
  source: string;
  confidence: string;
  precision: string;
  accountCreationProven: boolean;
  unknowns: string[];
  analyzedAtUtc: string;
}

export interface TrustedIdentitySourceResponse {
  url: string;
  publisher: string;
  sourceTrust: string;
  mintLinkStatus: string;
  referencedRelevantMints: string[];
  evidenceSummary: string;
}

export interface TrustedIdentityProvenanceResponse {
  sources: TrustedIdentitySourceResponse[];
  evidence: TokenIdentityEvidenceResponse[];
  conflicts: TokenIdentityEvidenceResponse[];
  unknowns: string[];
  analyzedAtUtc: string;
}

export interface TokenIdentityClassificationResponse {
  classification: string;
  confidence: string;
  relevantCompetingMint: string | null;
  evidence: string[];
  limitations: string[];
}

export interface TokenIdentityProvenanceResponse {
  result: string;
  confidence: string;
  scannedIdentity: {
    mint: string;
    rawName: string | null;
    normalizedName: string | null;
    rawSymbol: string | null;
    normalizedSymbol: string | null;
    observedAtUtc: string;
  };
  earliestObservedMatch: {
    mint: string;
    observedAtUtc: string;
    semantics: string;
  } | null;
  collisions: TokenIdentityCollisionResponse[];
  totalCollisionCount: number;
  returnedCollisionCount: number;
  isTruncated: boolean;
  evidence: TokenIdentityEvidenceResponse[];
  conflictingEvidence: TokenIdentityEvidenceResponse[];
  unknowns: string[];
  analyzedAtUtc: string;
  onChainChronology: OnChainChronologyResponse | null;
  trustedIdentityProvenance: TrustedIdentityProvenanceResponse | null;
  identityClassification: TokenIdentityClassificationResponse | null;
}

export interface TokenInspectionCoachContentResponse {
  summary: string;
  riskExplanations: string[];
  whatToCheckNext: string[];
  uncertainty: string[];
  recommendedTrainingTopicId: string | null;
  coachVersion: number;
  generatedAtUtc: string;
}

export interface TokenInspectionCoachResponse {
  available: boolean;
  status: string;
  coach: TokenInspectionCoachContentResponse | null;
}

export type TokenAnalysisDeterministicStatus =
  | 'idle'
  | 'validating'
  | 'loadingInspection'
  | 'loadingProvenance'
  | 'ready'
  | 'error';

export type TokenAnalysisAiStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface TokenAnalysisReport {
  mint: string;
  inspection: TokenInspectionResponse;
  provenance: TokenIdentityProvenanceResponse | null;
  provenanceWarning: string | null;
}

export interface TokenAnalysisTrainingCta {
  topic: WalletTrainingTopic;
  exerciseId: string;
}

export type TokenInspectionApiErrorReason =
  | 'invalid-mint'
  | 'mint-not-found'
  | 'unsupported-token'
  | 'provider-unavailable'
  | 'backend-unavailable'
  | 'cache-unavailable'
  | 'invalid-response'
  | 'request-cancelled'
  | 'unknown';

export class TokenInspectionApiError extends Error {
  constructor(readonly reason: TokenInspectionApiErrorReason, message: string) {
    super(message);
    this.name = 'TokenInspectionApiError';
  }
}
