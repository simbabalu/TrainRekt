import { describe, expect, it } from 'vitest';

import { buildProvenanceSourcePresentation, buildReviewSignalPresentation } from './tokenAnalysisFullAnalysisPresentation';
import type { TokenAnalysisReport } from '@/types/tokenAnalysis';

function createReport(overrides: Partial<TokenAnalysisReport['inspection']> = {}, provenanceOverrides: Partial<NonNullable<TokenAnalysisReport['provenance']>> = {}): TokenAnalysisReport {
  return {
    mint: 'Mint1111111111111111111111111111111111',
    inspection: {
      identity: { mint: 'Mint1111111111111111111111111111111111', name: 'Token', symbol: 'TOK' },
      authorities: { mintAuthorityRevoked: false, freezeAuthorityRevoked: true, mintAuthority: 'Auth111', freezeAuthority: null },
      program: { programId: 'Tokenkeg', programType: 'spl-token' },
      age: { ageSeconds: null, isReliable: false, unavailableReason: null },
      holderConcentration: { topHolderPercentage: 46.17, top5HoldersPercentage: 59.61, top10HoldersPercentage: 70.74, semanticsNote: 'Token-account concentration.', unclassifiedTokenAccountConcentration: null },
      largestTokenAccounts: [],
      protocolContext: null,
      reviewSignals: [],
      inspectedAtUtc: new Date().toISOString(),
      ...overrides,
    },
    provenance: {
      result: 'NO_COLLISION_EVIDENCE',
      confidence: 'MEDIUM',
      scannedIdentity: { mint: 'Mint1111111111111111111111111111111111', rawName: 'Token', normalizedName: 'token', rawSymbol: 'TOK', normalizedSymbol: 'tok', observedAtUtc: new Date().toISOString() },
      earliestObservedMatch: null,
      collisions: [],
      totalCollisionCount: 0,
      returnedCollisionCount: 0,
      isTruncated: false,
      evidence: [],
      conflictingEvidence: [],
      unknowns: [],
      analyzedAtUtc: new Date().toISOString(),
      onChainChronology: null,
      trustedIdentityProvenance: { sources: [], evidence: [], conflicts: [], unknowns: [], analyzedAtUtc: new Date().toISOString() },
      identityClassification: { classification: 'NO_COLLISION_EVIDENCE', confidence: 'MEDIUM', relevantCompetingMint: null, evidence: [], limitations: [] },
      ...provenanceOverrides,
    },
    provenanceWarning: null,
  };
}

describe('tokenAnalysisFullAnalysisPresentation', () => {
  it('deduplicates overlapping mint-supply review signals into one combined presentation item', () => {
    const reviewItems = buildReviewSignalPresentation(createReport({
      reviewSignals: [
        { id: 'ACTIVE_MINT_AUTHORITY', category: 'review', severity: 'medium', explanation: 'An active mint authority can increase token supply.', evidence: {} },
        { id: 'DOCUMENTED_INFLATIONARY_ISSUANCE', category: 'informational', severity: 'info', explanation: 'Ongoing inflationary issuance is documented and consistent with active mint authority.', evidence: {} },
        { id: 'ACTIVE_FREEZE_AUTHORITY', category: 'review', severity: 'medium', explanation: 'Freeze authority is active.', evidence: {} },
      ],
      protocolContext: {
        protocol: 'solana-mobile-skr',
        sources: [],
        claims: [{
          id: 'DOCUMENTED_INFLATIONARY_ISSUANCE',
          category: 'issuance',
          statement: 'SKR has scheduled emissions.',
          verificationStatus: 'Documented',
          verificationMethod: 'DocumentationOnly',
          sourceIds: ['skr-docs'],
          observedFactReferences: [],
          verificationNote: null,
          consistency: 'Consistent',
        }],
      },
    }));

    const merged = reviewItems.find((item) => item.id === 'merged:mint-supply-context');
    expect(merged).toBeDefined();
    expect(merged?.details.join(' ')).toContain('not been independently verified');
    expect(reviewItems.find((item) => item.id === 'signal:ACTIVE_MINT_AUTHORITY')).toBeUndefined();
    expect(reviewItems.find((item) => item.id === 'signal:DOCUMENTED_INFLATIONARY_ISSUANCE')).toBeUndefined();
    expect(reviewItems.find((item) => item.id === 'signal:ACTIVE_FREEZE_AUTHORITY')).toBeDefined();
  });

  it('does not infer contextual emissions when protocol context is missing', () => {
    const reviewItems = buildReviewSignalPresentation(createReport({
      identity: { mint: 'OtherMint11111111111111111111111111111111', name: 'SKR', symbol: 'SKR' },
      reviewSignals: [
        { id: 'ACTIVE_MINT_AUTHORITY', category: 'review', severity: 'medium', explanation: 'An active mint authority can increase token supply.', evidence: {} },
      ],
      protocolContext: null,
    }));

    expect(reviewItems.some((item) => item.id === 'merged:mint-supply-context')).toBe(false);
    expect(reviewItems.find((item) => item.id === 'signal:ACTIVE_MINT_AUTHORITY')).toBeDefined();
  });

  it('maps provenance source outcomes into distinct result states with stable unique ids', () => {
    const items = buildProvenanceSourcePresentation(createReport({}, {
      trustedIdentityProvenance: {
        sources: [
          { url: 'https://a.test', publisher: 'A', sourceTrust: 'TRUSTED', mintLinkStatus: 'REFERENCES_SCANNED_MINT', referencedRelevantMints: ['mint'], evidenceSummary: 'Exact mint.' },
          { url: 'https://b.test', publisher: 'B', sourceTrust: 'TRUSTED', mintLinkStatus: 'NO_RELEVANT_MINT_REFERENCE', referencedRelevantMints: [], evidenceSummary: 'No mint.' },
          { url: 'https://c.test', publisher: 'C', sourceTrust: 'TRUSTED', mintLinkStatus: 'FETCH_UNAVAILABLE', referencedRelevantMints: [], evidenceSummary: 'Fetch issue.' },
        ],
        evidence: [],
        conflicts: [],
        unknowns: [],
        analyzedAtUtc: new Date().toISOString(),
      },
    }));

    expect(items.map((item) => item.result)).toEqual(['EXACT MINT MATCH', 'NO MINT REFERENCE', 'FETCH UNAVAILABLE']);
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
