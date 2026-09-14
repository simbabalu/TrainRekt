import { getConsistentIssuanceContext } from '@/domain/token-analysis/tokenAnalysisAuthorityContext';
import { presentTrustedMintLinkStatus } from '@/domain/token-analysis/tokenAnalysisPresentation';
import type { TokenAnalysisReport, TokenInspectionReviewSignal, TrustedIdentitySourceResponse } from '@/types/tokenAnalysis';

export type FullAnalysisTone = 'positive' | 'review' | 'informational' | 'neutral';

export interface FullAnalysisReviewSignalItem {
  id: string;
  label: string;
  value: string;
  details: string[];
  tone: FullAnalysisTone;
}

export interface FullAnalysisProvenanceSourceItem {
  id: string;
  result: string;
  detail: string;
  publisher: string;
  sourceTrust: string;
  evidenceSummary: string;
  url: string;
  tone: FullAnalysisTone;
}

export type TrustedIdentityConclusionState = 'confirmed' | 'partially-supported' | 'unverified' | 'conflicting';

export interface TrustedIdentityConclusionPresentation {
  state: TrustedIdentityConclusionState;
  title: string;
  summary: string;
  trustedSourcesChecked: number;
  exactMintConfirmations: number;
  conflictingMintReferences: number;
}

function signalTone(signal: TokenInspectionReviewSignal): FullAnalysisTone {
  const severity = signal.severity.toUpperCase();
  if (severity === 'HIGH' || severity === 'MEDIUM') return 'review';
  if (severity === 'INFO') return 'informational';
  return 'neutral';
}

function summarizeSignal(signal: TokenInspectionReviewSignal): FullAnalysisReviewSignalItem {
  return {
    id: `signal:${signal.id}`,
    label: signal.category.toUpperCase(),
    value: signal.severity.toUpperCase(),
    details: [signal.explanation],
    tone: signalTone(signal),
  };
}

function mintReferenceTone(status: string): FullAnalysisTone {
  switch (status) {
    case 'REFERENCES_SCANNED_MINT':
      return 'positive';
    case 'REFERENCES_COMPETING_MINT':
    case 'REFERENCES_MULTIPLE_RELEVANT_MINTS':
      return 'review';
    case 'FETCH_UNAVAILABLE':
    case 'NO_RELEVANT_MINT_REFERENCE':
      return 'neutral';
    default:
      return 'informational';
  }
}

function isTrustedSource(sourceTrust: string): boolean {
  return sourceTrust === 'TRUSTED';
}

function isExactMintReference(status: string): boolean {
  return status === 'REFERENCES_SCANNED_MINT';
}

function isConflictingMintReference(status: string): boolean {
  return status === 'REFERENCES_COMPETING_MINT' || status === 'REFERENCES_MULTIPLE_RELEVANT_MINTS';
}

export function buildTrustedIdentityConclusion(report: TokenAnalysisReport): TrustedIdentityConclusionPresentation {
  const sources = report.provenance?.trustedIdentityProvenance?.sources ?? [];
  const trustedSources = sources.filter((source) => isTrustedSource(source.sourceTrust));
  const exactMintConfirmations = trustedSources.filter((source) => isExactMintReference(source.mintLinkStatus)).length;
  const conflictingMintReferences = trustedSources.filter((source) => isConflictingMintReference(source.mintLinkStatus)).length;

  if (conflictingMintReferences > 0) {
    return {
      state: 'conflicting',
      title: 'IDENTITY EVIDENCE CONFLICTING',
      summary: 'Trusted sources include conflicting mint references for this identity.',
      trustedSourcesChecked: trustedSources.length,
      exactMintConfirmations,
      conflictingMintReferences,
    };
  }

  if (exactMintConfirmations >= 2) {
    return {
      state: 'confirmed',
      title: 'TRUSTED IDENTITY CONFIRMED',
      summary: 'Multiple trusted sources reference this exact mint.',
      trustedSourcesChecked: trustedSources.length,
      exactMintConfirmations,
      conflictingMintReferences,
    };
  }

  if (exactMintConfirmations === 1) {
    return {
      state: 'partially-supported',
      title: 'IDENTITY PARTIALLY SUPPORTED',
      summary: 'One trusted source references this exact mint, but confirmation remains limited.',
      trustedSourcesChecked: trustedSources.length,
      exactMintConfirmations,
      conflictingMintReferences,
    };
  }

  return {
    state: 'unverified',
    title: 'IDENTITY UNVERIFIED',
    summary: 'Trusted sources did not provide exact mint confirmation for this token identity.',
    trustedSourcesChecked: trustedSources.length,
    exactMintConfirmations,
    conflictingMintReferences,
  };
}

function mintReferenceResult(status: string): string {
  switch (status) {
    case 'REFERENCES_SCANNED_MINT':
      return 'EXACT MINT MATCH';
    case 'REFERENCES_COMPETING_MINT':
      return 'COMPETING MINT REFERENCE';
    case 'REFERENCES_MULTIPLE_RELEVANT_MINTS':
      return 'MULTIPLE MINT REFERENCES';
    case 'NO_RELEVANT_MINT_REFERENCE':
      return 'NO MINT REFERENCE';
    case 'FETCH_UNAVAILABLE':
      return 'FETCH UNAVAILABLE';
    case 'UNVERIFIED':
      return 'MINT LINK UNVERIFIED';
    default:
      return 'MINT REFERENCE UNKNOWN';
  }
}

function provenanceSourceItem(source: TrustedIdentitySourceResponse, index: number): FullAnalysisProvenanceSourceItem {
  return {
    id: `source:${source.url}:${source.mintLinkStatus}:${index}`,
    result: mintReferenceResult(source.mintLinkStatus),
    detail: presentTrustedMintLinkStatus(source.mintLinkStatus),
    publisher: source.publisher || 'Unknown publisher',
    sourceTrust: source.sourceTrust,
    evidenceSummary: source.evidenceSummary,
    url: source.url,
    tone: mintReferenceTone(source.mintLinkStatus),
  };
}

export function buildReviewSignalPresentation(report: TokenAnalysisReport): FullAnalysisReviewSignalItem[] {
  const merged = new Set<string>();
  const output: FullAnalysisReviewSignalItem[] = [];
  const activeMintSignal = report.inspection.reviewSignals.find((signal) => signal.id === 'ACTIVE_MINT_AUTHORITY');
  const documentedIssuanceSignal = report.inspection.reviewSignals.find((signal) => signal.id === 'DOCUMENTED_INFLATIONARY_ISSUANCE');
  const issuanceContext = getConsistentIssuanceContext(report);

  if (activeMintSignal && documentedIssuanceSignal && issuanceContext && !report.inspection.authorities.mintAuthorityRevoked) {
    merged.add(activeMintSignal.id);
    merged.add(documentedIssuanceSignal.id);

    output.push({
      id: 'merged:mint-supply-context',
      label: 'MINT SUPPLY',
      value: 'Active authority',
      tone: 'review',
      details: [
        'An active mint authority can increase token supply.',
        issuanceContext.confidenceLabel === 'verified'
          ? 'Consistent with documented scheduled emissions.'
          : 'Consistent with project-linked documented scheduled emissions.',
        'Authority/control mechanism has not been independently verified.',
      ],
    });
  }

  for (const signal of report.inspection.reviewSignals) {
    if (merged.has(signal.id)) continue;
    output.push(summarizeSignal(signal));
  }

  return output;
}

export function buildProvenanceSourcePresentation(report: TokenAnalysisReport): FullAnalysisProvenanceSourceItem[] {
  const sources = report.provenance?.trustedIdentityProvenance?.sources ?? [];
  return sources.map(provenanceSourceItem);
}
