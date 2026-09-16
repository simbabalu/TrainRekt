import {
  presentMintAuthorityContextLine,
  presentTokenomicsContextDescription,
} from '@/domain/token-analysis/tokenAnalysisAuthorityContext';
import type {
  TokenAnalysisReport,
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

function summarizeReviewExplanation(signal: TokenInspectionReviewSignal): string {
  return signal.explanation;
}

function reviewSignalTone(signal: TokenInspectionReviewSignal): TokenAnalysisSignalTone {
  const severity = signal.severity.toUpperCase();
  const category = signal.category.toUpperCase();
  if (severity === 'INFO' || category === 'INFORMATIONAL') return 'informational';
  return 'review';
}

function reviewSignalIcon(signal: TokenInspectionReviewSignal): TokenAnalysisSignalIcon {
  return reviewSignalTone(signal) === 'informational' ? 'tokenProgram' : 'review';
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
  const topFiveAccounts = report.inspection.largestTokenAccounts.slice(0, 5);
  const percentage = report.inspection.holderConcentration.top5HoldersPercentage;
  if (percentage == null) return null;

  const protocolAccountCount = topFiveAccounts.filter((account) => Boolean(account.classification.protocol)).length;
  const hasKnownProtocolAccounts = protocolAccountCount > 0;
  const description = hasKnownProtocolAccounts
    ? `${protocolAccountCount} of top 5 accounts are known protocol/liquidity accounts.`
    : 'Top accounts include unknown or ordinary token accounts.';

  return {
    id: 'concentration:top-5',
    icon: 'concentration',
    label: 'TOP 5 TOKEN ACCOUNTS',
    value: formatPercentage(percentage),
    description,
    tone: hasKnownProtocolAccounts ? 'informational' : 'review',
  };
}

export function buildTokenAnalysisSummary(report: TokenAnalysisReport): TokenAnalysisSummary {
  const findings: TokenAnalysisSignal[] = [];
  findings.push(authoritySignal('authority:mint', 'MINT AUTHORITY', report.inspection.authorities.mintAuthorityRevoked, mintAuthorityDescription(report)));
  findings.push(authoritySignal('authority:freeze', 'FREEZE AUTHORITY', report.inspection.authorities.freezeAuthorityRevoked));

  const isToken2022 = report.inspection.program.programType.toLowerCase().includes('token-2022');
  findings.push({
    id: 'program',
    icon: 'tokenProgram',
    label: 'TOKEN PROGRAM',
    value: isToken2022 ? 'Token-2022' : 'SPL Token',
    description: isToken2022 ? 'Extended token standard; features are informational, not a risk verdict.' : undefined,
    tone: 'informational',
  });

  const concentration = concentrationSignal(report);
  if (concentration) findings.push(concentration);

  const tokenomics = tokenomicsSignal(report);
  if (tokenomics) findings.push(tokenomics);

  for (const signal of report.inspection.reviewSignals.slice(0, 3)) {
    const tone = reviewSignalTone(signal);
    findings.push({
      id: `review:${signal.id}:${signal.category}:${signal.severity}`,
      icon: reviewSignalIcon(signal),
      label: signal.category.toUpperCase(),
      value: signal.severity,
      description: summarizeReviewExplanation(signal),
      tone,
    });
  }

  return {
    status: report.inspection.reviewSignals.length > 0 ? 'NEEDS REVIEW' : 'NO REVIEW SIGNALS',
    findings,
  };
}
