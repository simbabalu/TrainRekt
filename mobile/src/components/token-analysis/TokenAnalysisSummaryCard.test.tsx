import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';

import { TokenAnalysisSummaryCard } from './TokenAnalysisSummaryCard';
import type { TokenAnalysisReport } from '@/types/tokenAnalysis';

vi.mock('react-native', () => ({
  Image: 'Image',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('@/components/AppIcon', () => ({
  AppIcon: () => React.createElement('View', null, React.createElement('Text', null, 'GENERIC_TOKEN_ICON')),
}));

vi.mock('@/components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));

vi.mock('@/components/token-analysis/TokenAnalysisSignalRow', () => ({
  TokenAnalysisSignalRow: ({ signal }: { signal: { label: string; value: string } }) => React.createElement('Text', null, `${signal.label}:${signal.value}`),
}));

function report(): TokenAnalysisReport {
  return {
    mint: 'Mint1111111111111111111111111111111111',
    inspection: {
      identity: { mint: 'Mint1111111111111111111111111111111111', name: 'Token', symbol: 'TOK' },
      authorities: { mintAuthorityRevoked: false, freezeAuthorityRevoked: true, mintAuthority: 'Auth111', freezeAuthority: null },
      program: { programId: 'Tokenkeg', programType: 'spl-token' },
      age: { ageSeconds: 1, isReliable: true, unavailableReason: null },
      holderConcentration: { topHolderPercentage: 46.17, top5HoldersPercentage: 59.61, top10HoldersPercentage: 70.74, semanticsNote: 'note', unclassifiedTokenAccountConcentration: null },
      largestTokenAccounts: [{ address: 'Pool111111111111111111111111111111111111', percentage: 46.17, classification: { classification: 'LIQUIDITY_POOL', protocol: 'pumpswap', confidence: 'HIGH' } }],
      reviewSignals: [
        { id: 'signal-1', category: 'Review', severity: 'info', explanation: 'First repeated severity.', evidence: {} },
        { id: 'signal-2', category: 'Review', severity: 'info', explanation: 'Second repeated severity.', evidence: {} },
      ],
      inspectedAtUtc: new Date().toISOString(),
    },
    provenance: {
      result: 'NO_COLLISION_EVIDENCE',
      confidence: 'MEDIUM',
      scannedIdentity: {
        mint: 'Mint1111111111111111111111111111111111',
        rawName: 'Token',
        normalizedName: 'token',
        rawSymbol: 'TOK',
        normalizedSymbol: 'tok',
        observedAtUtc: new Date().toISOString(),
      },
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
      identityClassification: {
        classification: 'NO_COLLISION_EVIDENCE',
        confidence: 'MEDIUM',
        relevantCompetingMint: null,
        evidence: [],
        limitations: [],
      },
    },
    provenanceWarning: null,
  };
}

function textContent(renderer: ReturnType<typeof create>): string {
  return renderer.root.findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

describe('TokenAnalysisSummaryCard keys', () => {
  it('does not render identity in key findings and keeps core technical findings', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <TokenAnalysisSummaryCard
          report={report()}
        />,
      );
    });

    const content = textContent(renderer);
    expect(content).not.toContain('IDENTITY:');
    expect(content).toContain('Token');
    expect(content).toContain('TOK');
    expect(content).toContain('Mint');
    expect(content).toContain('MINT AUTHORITY:Active');
    expect(content).toContain('FREEZE AUTHORITY:Revoked');
    expect(content).toContain('TOKEN PROGRAM:SPL Token');
    expect(content).toContain('TOP 5 TOKEN ACCOUNTS:59.61%');
  });

  it('renders repeated findings without duplicate React key warnings', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    act(() => {
      create(
        <TokenAnalysisSummaryCard
          report={report()}
        />,
      );
    });

    const duplicateKeyWarning = consoleErrorSpy.mock.calls
      .map((call) => call.join(' '))
      .find((message) => message.includes('Encountered two children with the same key'));

    expect(duplicateKeyWarning).toBeUndefined();
    consoleErrorSpy.mockRestore();
  });

  it('keeps existing behavior when researchStatus is missing', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <TokenAnalysisSummaryCard
          report={report()}
        />, 
      );
    });

    const content = textContent(renderer);
    expect(content).toContain('Deterministic inspection: complete.');
    expect(content).not.toContain('Optional external research:');
    expect(content).toContain('Mint1111111111111111111111111111111111');
  });

  it('shows complete optional research indicator', () => {
    const withComplete: TokenAnalysisReport = {
      ...report(),
      inspection: {
        ...report().inspection,
        researchStatus: {
          availability: 'complete',
          failureCategory: null,
          failureStage: null,
          message: null,
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisSummaryCard
          report={withComplete}
        />,
      );
    });

    expect(textContent(renderer)).toContain('Optional external research: complete.');
  });

  it('shows partial optional research indicator', () => {
    const withPartial: TokenAnalysisReport = {
      ...report(),
      inspection: {
        ...report().inspection,
        researchStatus: {
          availability: 'partial',
          failureCategory: 'invalid-provider-response',
          failureStage: 'structured_extraction',
          message: 'Optional research completed but did not produce trusted usable context.',
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisSummaryCard
          report={withPartial}
        />,
      );
    });

    expect(textContent(renderer)).toContain('Optional external research: partially available.');
  });

  it('shows unavailable optional research indicator while keeping deterministic inspection visible', () => {
    const withUnavailable: TokenAnalysisReport = {
      ...report(),
      inspection: {
        ...report().inspection,
        researchStatus: {
          availability: 'unavailable',
          failureCategory: 'timeout',
          failureStage: 'provider_timeout',
          message: 'Optional research timed out.',
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisSummaryCard
          report={withUnavailable}
        />,
      );
    });

    const content = textContent(renderer);
    expect(content).toContain('Additional external research is unavailable. Deterministic inspection remains available.');
    expect(content).toContain('Mint1111111111111111111111111111111111');
  });

  it('shows not-attempted optional research indicator', () => {
    const withNotAttempted: TokenAnalysisReport = {
      ...report(),
      inspection: {
        ...report().inspection,
        researchStatus: {
          availability: 'not-attempted',
          failureCategory: null,
          failureStage: null,
          message: null,
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisSummaryCard
          report={withNotAttempted}
        />,
      );
    });

    expect(textContent(renderer)).toContain('Optional external research: not attempted.');
  });

  it('does not render deeper-analysis actions inside the summary card', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TokenAnalysisSummaryCard report={report()} />);
    });

    const content = textContent(renderer);
    expect(content).not.toContain('UNDERSTAND THE SIGNALS');
    expect(content).not.toContain('VIEW FULL ANALYSIS');
    expect(content).not.toContain('HIDE FULL ANALYSIS');
  });

  it('uses Unknown fallback values when metadata fields are unavailable', () => {
    const unresolved: TokenAnalysisReport = {
      ...report(),
      inspection: {
        ...report().inspection,
        identity: {
          ...report().inspection.identity,
          name: null,
          symbol: null,
          logoUri: null,
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenAnalysisSummaryCard report={unresolved} />);
    });

    const content = textContent(renderer);
    expect(content).toContain('Unknown');
    expect(content).toContain('GENERIC_TOKEN_ICON');
  });
});
