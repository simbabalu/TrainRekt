import type { TokenAnalysisReport, TokenInspectionDocumentedClaim } from '@/types/tokenAnalysis';

export interface MintAuthorityContext {
  issuanceClaim: TokenInspectionDocumentedClaim;
  confidenceLabel: 'verified' | 'project-linked';
}

function claimById(report: TokenAnalysisReport, claimId: string): TokenInspectionDocumentedClaim | null {
  const claims = report.inspection.protocolContext?.claims;
  if (!claims?.length) return null;
  return claims.find((claim) => claim.id === claimId) ?? null;
}

export function getConsistentIssuanceContext(report: TokenAnalysisReport): MintAuthorityContext | null {
  const issuanceClaim = claimById(report, 'DOCUMENTED_INFLATIONARY_ISSUANCE');
  if (!issuanceClaim || issuanceClaim.consistency !== 'Consistent') return null;

  return {
    issuanceClaim,
    confidenceLabel: issuanceClaim.verificationStatus === 'Verified' ? 'verified' : 'project-linked',
  };
}

export function presentMintAuthorityContextLine(report: TokenAnalysisReport): string | undefined {
  const context = getConsistentIssuanceContext(report);
  if (!context || report.inspection.authorities.mintAuthorityRevoked) return undefined;

  if (context.confidenceLabel === 'verified') {
    return 'Expected for scheduled token emissions';
  }

  return 'Project-linked documentation describes scheduled emissions';
}

export function presentTokenomicsContextDescription(report: TokenAnalysisReport): string | undefined {
  const context = getConsistentIssuanceContext(report);
  if (!context) return undefined;

  if (context.confidenceLabel === 'verified') {
    return 'New tokens may be issued according to the documented emission schedule.';
  }

  return 'New tokens may be issued according to project-linked documentation.';
}
