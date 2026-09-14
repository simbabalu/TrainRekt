import { presentIdentityClassification } from '@/domain/token-analysis/tokenAnalysisPresentation';
import {
  presentMintAuthorityContextLine,
  presentTokenomicsContextDescription,
} from '@/domain/token-analysis/tokenAnalysisAuthorityContext';
import type {
  TokenAnalysisReport,
  TokenInspectionLargestAccount,
  TokenInspectionReviewSignal,
} from '@/types/tokenAnalysis';

export type TokenAnalysisSummaryStatus = 'NEEDS REVIEW' | 'NO REVIEW SIGNALS';
export type TokenAnalysisSignalTone = 'positive' | 'review' | 'informational' | 'neutral';
export type TokenAnalysisSignalIcon = 'identity' | 'authority' | 'tokenProgram' | 'concentration' | 'review';

export interface TokenAnalysisSignal {
  id: string;
  icon: TokenAnalysisSignalIcon;
  label: string;
  value: string;
  description?: string;
  tone: TokenAnalysisSignalTone;
}

export interface TokenAnalysisSummary {
  status: TokenAnalysisSummaryStatus;
  findings: TokenAnalysisSignal[];
}

function formatPercentage(value: number | null): string {
  return value == null ? 'Unavailable' : `${value.toFixed(2)}%`;
}

function formatProtocolContext(account: TokenInspectionLargestAccount): string {
  const protocol = account.classification.protocol;
  if (protocol?.toLowerCase() === 'pumpswap') return 'PumpSwap liquidity context';
  if (protocol) {
    return `${protocol
      .split(/[_-]/u)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')} protocol context`;
  }

  return 'Context unknown';
}

function summarizeReviewExplanation(signal: TokenInspectionReviewSignal): string {
  const firstSentence = signal.explanation.split(/[.!?]/u)[0]?.trim() ?? '';
  if (firstSentence.length <= 88) return firstSentence;
  return `${firstSentence.slice(0, 85).trimEnd()}...`;
}

function mintAuthorityDescription(report: TokenAnalysisReport): string | undefined {
  return presentMintAuthorityContextLine(report);
}

function tokenomicsSignal(report: TokenAnalysisReport): TokenAnalysisSignal | null {
  const description = presentTokenomicsContextDescription(report);
  if (!description) return null;

  const issuanceClaim = report.inspection.protocolContext?.claims.find((claim) => claim.id === 'DOCUMENTED_INFLATIONARY_ISSUANCE');
  if (!issuanceClaim) return null;

  return {
    id: `tokenomics:${issuanceClaim.id}`,
    icon: 'tokenProgram',
    label: 'TOKENOMICS',
    value: 'Inflationary supply model',
    description,
    tone: 'informational',
  };
}

function identitySignal(report: TokenAnalysisReport): TokenAnalysisSignal | null {
  const classification = report.provenance?.identityClassification;
  if (!classification) return null;

  switch (classification.classification) {
    case 'NO_COLLISION_EVIDENCE':
      return { id: 'identity', icon: 'identity', label: 'IDENTITY', value: 'Not verified', description: 'No comparison identity found', tone: 'review' };
    case 'COLLISION_DETECTED':
    case 'POSSIBLE_COPYCAT':
    case 'IDENTITY_CONFLICT':
      return { id: 'identity', icon: 'identity', label: 'IDENTITY', value: 'Needs review', description: presentIdentityClassification(classification.classification).title, tone: 'review' };
    default:
      return { id: 'identity', icon: 'identity', label: 'IDENTITY', value: 'Insufficient evidence', description: 'Identity comparison is limited', tone: 'neutral' };
  }
}

function authoritySignal(id: string, label: string, revoked: boolean, description?: string): TokenAnalysisSignal {
  return {
    id,
    icon: 'authority',
    label,
    value: revoked ? 'Revoked' : 'Active',
    description,
    tone: revoked ? 'positive' : 'review',
  };
}

function concentrationSignal(report: TokenAnalysisReport): TokenAnalysisSignal | null {
  const largestAccount = report.inspection.largestTokenAccounts[0];
  const percentage = largestAccount?.percentage ?? report.inspection.holderConcentration.topHolderPercentage;
  if (percentage == null) return null;

  return {
    id: `concentration:${largestAccount?.address ?? 'top-holder'}`,
    icon: 'concentration',
    label: 'LARGEST TOKEN ACCOUNT',
    value: formatPercentage(percentage),
    description: largestAccount ? formatProtocolContext(largestAccount) : 'Context unknown',
    tone: largestAccount?.classification.protocol ? 'review' : 'neutral',
  };
}

export function buildTokenAnalysisSummary(report: TokenAnalysisReport): TokenAnalysisSummary {
  const findings: TokenAnalysisSignal[] = [];
  const identity = identitySignal(report);
  if (identity) findings.push(identity);

  findings.push(authoritySignal('authority:mint', 'MINT AUTHORITY', report.inspection.authorities.mintAuthorityRevoked, mintAuthorityDescription(report)));
  findings.push(authoritySignal('authority:freeze', 'FREEZE AUTHORITY', report.inspection.authorities.freezeAuthorityRevoked));

  const isToken2022 = report.inspection.program.programType.toLowerCase().includes('token-2022');
  findings.push({
    id: 'program',
    icon: 'tokenProgram',
    label: 'TOKEN PROGRAM',
    value: isToken2022 ? 'Token-2022' : 'SPL Token',
    description: isToken2022 ? 'Additional capabilities detected' : undefined,
    tone: 'informational',
  });

  const concentration = concentrationSignal(report);
  if (concentration) findings.push(concentration);

  const tokenomics = tokenomicsSignal(report);
  if (tokenomics) findings.push(tokenomics);

  for (const signal of report.inspection.reviewSignals.slice(0, 3)) {
    findings.push({
      id: `review:${signal.id}:${signal.category}:${signal.severity}`,
      icon: 'review',
      label: signal.category.toUpperCase(),
      value: signal.severity,
      description: summarizeReviewExplanation(signal),
      tone: 'review',
    });
  }

  return {
    status: report.inspection.reviewSignals.length > 0 ? 'NEEDS REVIEW' : 'NO REVIEW SIGNALS',
    findings,
  };
}
