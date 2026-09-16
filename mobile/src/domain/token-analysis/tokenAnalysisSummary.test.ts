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

describe('buildTokenAnalysisSummary', () => {
  it('does not include identity in key findings and keeps technical findings visible', () => {
    const summary = buildTokenAnalysisSummary(createReport());

    expect(summary.findings.find((finding) => finding.label === 'IDENTITY')).toBeUndefined();
    expect(summary.findings.find((finding) => finding.label === 'MINT AUTHORITY')).toBeDefined();
    expect(summary.findings.find((finding) => finding.label === 'FREEZE AUTHORITY')).toBeDefined();
    expect(summary.findings.find((finding) => finding.label === 'TOKEN PROGRAM')).toBeDefined();
    expect(summary.findings.find((finding) => finding.label === 'TOP 5 TOKEN ACCOUNTS')).toBeDefined();
  });

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

    expect(program).toMatchObject({ value: 'Token-2022', description: 'Extended token standard; features are informational, not a risk verdict.', tone: 'informational' });
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

  it('keeps informational review signals informational and does not truncate long descriptions', () => {
    const longDescription = 'Ongoing inflationary issuance is documented, and the observed active mint authority is consistent with that model.';

    const summary = buildTokenAnalysisSummary(createReport({
      reviewSignals: [
        {
          id: 'DOCUMENTED_INFLATIONARY_ISSUANCE',
          category: 'informational',
          severity: 'info',
          explanation: longDescription,
          evidence: {},
        },
      ],
    }));

    const informational = summary.findings.find((finding) => finding.id.includes('DOCUMENTED_INFLATIONARY_ISSUANCE'));

    expect(informational).toMatchObject({
      label: 'INFORMATIONAL',
      value: 'info',
      tone: 'informational',
      icon: 'tokenProgram',
      description: longDescription,
    });
    expect(informational?.description).not.toContain('...');
  });
});
