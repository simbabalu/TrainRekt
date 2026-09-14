import { describe, expect, it } from 'vitest';

import { buildTokenAnalysisSummary } from './tokenAnalysisSummary';
import type { TokenAnalysisReport, TokenInspectionDocumentedClaim } from '@/types/tokenAnalysis';

function issuanceClaim(overrides: Partial<TokenInspectionDocumentedClaim> = {}): TokenInspectionDocumentedClaim {
  return {
    id: 'DOCUMENTED_INFLATIONARY_ISSUANCE',
    category: 'issuance',
    statement: 'Project docs describe scheduled token emissions.',
    verificationStatus: 'Documented',
    verificationMethod: 'DocumentationOnly',
    sourceIds: ['skr-docs'],
    observedFactReferences: [],
    verificationNote: 'Documented context is available but authority identity mapping is not independently verified.',
    consistency: 'Consistent',
    ...overrides,
  };
}

function createReport(overrides: Partial<TokenAnalysisReport['inspection']> = {}): TokenAnalysisReport {
  return {
    mint: 'Mint1111111111111111111111111111111111',
    inspection: {
      identity: { mint: 'Mint1111111111111111111111111111111111', name: 'The Little Hodler', symbol: 'TLH' },
      authorities: { mintAuthorityRevoked: false, freezeAuthorityRevoked: true, mintAuthority: 'MintAuth111', freezeAuthority: null },
      program: { programId: 'Tokenkeg', programType: 'spl-token' },
      age: { ageSeconds: null, isReliable: false, unavailableReason: null },
      holderConcentration: {
        topHolderPercentage: 46.17,
        top5HoldersPercentage: 59.61,
        top10HoldersPercentage: 70.74,
        semanticsNote: 'Token-account concentration is not beneficial-owner concentration.',
        unclassifiedTokenAccountConcentration: null,
      },
      largestTokenAccounts: [{
        address: 'Pool111111111111111111111111111111111111',
        percentage: 46.17,
        classification: { classification: 'LIQUIDITY_POOL', protocol: 'pumpswap', confidence: 'HIGH' },
      }],
      protocolContext: null,
      reviewSignals: [],
      inspectedAtUtc: new Date().toISOString(),
      ...overrides,
    },
    provenance: {
      result: 'NO_COLLISION_EVIDENCE',
      confidence: 'MEDIUM',
      scannedIdentity: { mint: 'Mint1111111111111111111111111111111111', rawName: 'The Little Hodler', normalizedName: 'the little hodler', rawSymbol: 'TLH', normalizedSymbol: 'tlh', observedAtUtc: new Date().toISOString() },
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
      trustedIdentityProvenance: null,
      identityClassification: { classification: 'NO_COLLISION_EVIDENCE', confidence: 'MEDIUM', relevantCompetingMint: null, evidence: [], limitations: [] },
    },
    provenanceWarning: null,
  };
}

function createReportWithProvenanceSources(
  sources: NonNullable<NonNullable<TokenAnalysisReport['provenance']>['trustedIdentityProvenance']>['sources'],
): TokenAnalysisReport {
  const base = createReport();
  return {
    ...base,
    provenance: {
      ...base.provenance!,
      trustedIdentityProvenance: {
        sources,
        evidence: [],
        conflicts: [],
        unknowns: [],
        analyzedAtUtc: new Date().toISOString(),
      },
    },
  };
}

describe('buildTokenAnalysisSummary', () => {
  it('keeps deterministic mint authority state as Active without context inference', () => {
    const summary = buildTokenAnalysisSummary(createReport());
    const mintAuthority = summary.findings.find((finding) => finding.label === 'MINT AUTHORITY');

    expect(mintAuthority).toMatchObject({ value: 'Active', tone: 'review' });
    expect(mintAuthority?.description).toBeUndefined();
  });

  it('renders project-linked context for active authority only when documented issuance context exists', () => {
    const summary = buildTokenAnalysisSummary(createReport({
      protocolContext: {
        protocol: 'solana-mobile-skr',
        sources: [{
          id: 'skr-docs',
          sourceType: 'OfficialDocumentation',
          title: 'SKR docs',
          publisher: 'Solana Mobile',
          url: 'https://docs.solanamobile.com/solana-mobile-stack/skr',
          retrievedAtUtc: null,
          publishedAtUtc: null,
        }],
        claims: [issuanceClaim()],
      },
    }));
    const mintAuthority = summary.findings.find((finding) => finding.label === 'MINT AUTHORITY');
    const tokenomics = summary.findings.find((finding) => finding.label === 'TOKENOMICS');

    expect(mintAuthority?.value).toBe('Active');
    expect(mintAuthority?.description).toBe('Project-linked documentation describes scheduled emissions');
    expect(tokenomics).toMatchObject({
      value: 'Inflationary supply model',
      tone: 'informational',
      description: 'New tokens may be issued according to project-linked documentation.',
    });
  });

  it('uses stronger wording only when the issuance claim is verified', () => {
    const summary = buildTokenAnalysisSummary(createReport({
      protocolContext: {
        protocol: 'verified-protocol',
        sources: [],
        claims: [issuanceClaim({ verificationStatus: 'Verified', verificationMethod: 'DeterministicReconciliation' })],
      },
    }));
    const mintAuthority = summary.findings.find((finding) => finding.label === 'MINT AUTHORITY');
    const tokenomics = summary.findings.find((finding) => finding.label === 'TOKENOMICS');

    expect(mintAuthority?.description).toBe('Expected for scheduled token emissions');
    expect(tokenomics?.description).toBe('New tokens may be issued according to the documented emission schedule.');
  });

  it('shows tokenomics context separately from authority state and avoids safety verdict wording', () => {
    const summary = buildTokenAnalysisSummary(createReport({
      protocolContext: { protocol: 'p', sources: [], claims: [issuanceClaim()] },
    }));

    const mintAuthority = summary.findings.find((finding) => finding.label === 'MINT AUTHORITY');
    const tokenomics = summary.findings.find((finding) => finding.label === 'TOKENOMICS');
    expect(mintAuthority?.value).toBe('Active');
    expect(tokenomics?.value).toBe('Inflationary supply model');
    expect(JSON.stringify(summary)).not.toContain('safe');
    expect(JSON.stringify(summary)).not.toContain('legitimate');
  });

  it('keeps revoked authority behavior unchanged', () => {
    const summary = buildTokenAnalysisSummary(createReport({
      authorities: { mintAuthorityRevoked: true, freezeAuthorityRevoked: true, mintAuthority: null, freezeAuthority: null },
      protocolContext: { protocol: 'p', sources: [], claims: [issuanceClaim()] },
    }));
    const mintAuthority = summary.findings.find((finding) => finding.label === 'MINT AUTHORITY');

    expect(mintAuthority).toMatchObject({ value: 'Revoked', tone: 'positive' });
    expect(mintAuthority?.description).toBeUndefined();
  });

  it('keeps Token-2022 rendering informational', () => {
    const summary = buildTokenAnalysisSummary(createReport({ program: { programId: 'TokenzQd', programType: 'token-2022' } }));
    const program = summary.findings.find((finding) => finding.label === 'TOKEN PROGRAM');

    expect(program).toMatchObject({ value: 'Token-2022', description: 'Additional capabilities detected', tone: 'informational' });
  });

  it('supports SKR-style context through typed protocol claims, not UI token matching', () => {
    const summary = buildTokenAnalysisSummary(createReport({
      identity: { mint: 'SomeOtherMint111111111111111111111111111111', name: 'Different Name', symbol: 'NOTSKR' },
      protocolContext: { protocol: 'solana-mobile-skr', sources: [], claims: [issuanceClaim()] },
    }));

    const mintAuthority = summary.findings.find((finding) => finding.label === 'MINT AUTHORITY');
    expect(mintAuthority?.description).toBe('Project-linked documentation describes scheduled emissions');
  });

  it('does not inherit SKR wording for unrelated active-mint tokens without context', () => {
    const summary = buildTokenAnalysisSummary(createReport({
      identity: { mint: 'AnotherMint111111111111111111111111111111', name: 'Other Token', symbol: 'OTK' },
      protocolContext: null,
    }));

    const mintAuthority = summary.findings.find((finding) => finding.label === 'MINT AUTHORITY');
    const tokenomics = summary.findings.find((finding) => finding.label === 'TOKENOMICS');

    expect(mintAuthority?.description).toBeUndefined();
    expect(tokenomics).toBeUndefined();
  });

  it('generates unique deterministic signal ids for repeated review severities', () => {
    const summary = buildTokenAnalysisSummary(createReport({
      reviewSignals: [
        { id: 's1', category: 'Review', severity: 'info', explanation: 'First info signal.', evidence: {} },
        { id: 's2', category: 'Review', severity: 'info', explanation: 'Second info signal.', evidence: {} },
      ],
    }));

    const ids = summary.findings.map((finding) => finding.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps 2+ trusted exact mint matches to confirmed identity in key findings', () => {
    const summary = buildTokenAnalysisSummary(createReportWithProvenanceSources([
      { url: 'https://docs.example/one', publisher: 'Official One', sourceTrust: 'TRUSTED', mintLinkStatus: 'REFERENCES_SCANNED_MINT', referencedRelevantMints: ['mint'], evidenceSummary: 'Exact mint one' },
      { url: 'https://docs.example/two', publisher: 'Official Two', sourceTrust: 'TRUSTED', mintLinkStatus: 'REFERENCES_SCANNED_MINT', referencedRelevantMints: ['mint'], evidenceSummary: 'Exact mint two' },
    ]));

    const identity = summary.findings.find((finding) => finding.label === 'IDENTITY');
    expect(identity).toMatchObject({
      value: 'Trusted identity confirmed',
      description: 'Multiple trusted sources reference this exact mint.',
      tone: 'positive',
    });
  });

  it('maps one trusted exact match to partially supported identity in key findings', () => {
    const summary = buildTokenAnalysisSummary(createReportWithProvenanceSources([
      { url: 'https://docs.example/one', publisher: 'Official One', sourceTrust: 'TRUSTED', mintLinkStatus: 'REFERENCES_SCANNED_MINT', referencedRelevantMints: ['mint'], evidenceSummary: 'Exact mint one' },
    ]));

    const identity = summary.findings.find((finding) => finding.label === 'IDENTITY');
    expect(identity).toMatchObject({
      value: 'Identity partially supported',
      description: 'One trusted source references this exact mint.',
      tone: 'informational',
    });
  });

  it('maps no exact trusted mint evidence to unverified identity in key findings', () => {
    const summary = buildTokenAnalysisSummary(createReportWithProvenanceSources([
      { url: 'https://docs.example/no-mint', publisher: 'Official', sourceTrust: 'TRUSTED', mintLinkStatus: 'NO_RELEVANT_MINT_REFERENCE', referencedRelevantMints: [], evidenceSummary: 'No relevant mint' },
      { url: 'https://docs.example/fetch', publisher: 'Official', sourceTrust: 'TRUSTED', mintLinkStatus: 'FETCH_UNAVAILABLE', referencedRelevantMints: [], evidenceSummary: 'Fetch unavailable' },
    ]));

    const identity = summary.findings.find((finding) => finding.label === 'IDENTITY');
    expect(identity).toMatchObject({
      value: 'Identity unverified',
      description: 'No trusted source currently confirms this exact mint.',
      tone: 'neutral',
    });
  });

  it('maps conflicting trusted mint evidence to conflict state in key findings', () => {
    const summary = buildTokenAnalysisSummary(createReportWithProvenanceSources([
      { url: 'https://docs.example/exact', publisher: 'Official', sourceTrust: 'TRUSTED', mintLinkStatus: 'REFERENCES_SCANNED_MINT', referencedRelevantMints: ['mint'], evidenceSummary: 'Exact mint' },
      { url: 'https://docs.example/conflict', publisher: 'Official', sourceTrust: 'TRUSTED', mintLinkStatus: 'REFERENCES_COMPETING_MINT', referencedRelevantMints: ['other'], evidenceSummary: 'Competing mint' },
    ]));

    const identity = summary.findings.find((finding) => finding.label === 'IDENTITY');
    expect(identity).toMatchObject({
      value: 'Identity conflict detected',
      description: 'Trusted evidence contains conflicting mint references.',
      tone: 'review',
    });
  });

  it('treats NO_MINT_REFERENCE and FETCH_UNAVAILABLE as neutral in summary identity state', () => {
    const summary = buildTokenAnalysisSummary(createReportWithProvenanceSources([
      { url: 'https://docs.example/exact', publisher: 'Official', sourceTrust: 'TRUSTED', mintLinkStatus: 'REFERENCES_SCANNED_MINT', referencedRelevantMints: ['mint'], evidenceSummary: 'Exact mint' },
      { url: 'https://docs.example/no-mint', publisher: 'Official', sourceTrust: 'TRUSTED', mintLinkStatus: 'NO_RELEVANT_MINT_REFERENCE', referencedRelevantMints: [], evidenceSummary: 'No relevant mint' },
      { url: 'https://docs.example/fetch', publisher: 'Official', sourceTrust: 'TRUSTED', mintLinkStatus: 'FETCH_UNAVAILABLE', referencedRelevantMints: [], evidenceSummary: 'Fetch unavailable' },
    ]));

    const identity = summary.findings.find((finding) => finding.label === 'IDENTITY');
    expect(identity).toMatchObject({
      value: 'Identity partially supported',
      description: 'One trusted source references this exact mint.',
    });
  });

  it('uses conservative fallback when provenance evidence is missing and never shows confirmed', () => {
    const base = createReport();
    const summary = buildTokenAnalysisSummary({
      ...base,
      provenance: null,
    });

    const identity = summary.findings.find((finding) => finding.label === 'IDENTITY');
    expect(identity).toMatchObject({
      value: 'Identity unverified',
      description: 'No trusted source currently confirms this exact mint.',
      tone: 'neutral',
    });
  });
});
