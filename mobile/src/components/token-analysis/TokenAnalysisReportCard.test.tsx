import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { TokenAnalysisReportCard } from './TokenAnalysisReportCard';
import type { TokenAnalysisReport, TokenInspectionCoachResponse } from '@/types/tokenAnalysis';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('@/components/AppIcon', () => ({ AppIcon: 'AppIcon' }));

Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (callback: () => void) => callback(),
  configurable: true,
});

function report(): TokenAnalysisReport {
  return {
    mint: 'Mint1111111111111111111111111111111111',
    inspection: {
      identity: { mint: 'Mint1111111111111111111111111111111111', name: 'The Little Hodler', symbol: 'TLH' },
      authorities: { mintAuthorityRevoked: true, freezeAuthorityRevoked: true, mintAuthority: null, freezeAuthority: null },
      program: { programId: 'Tokenkeg', programType: 'spl-token' },
      age: { ageSeconds: 1, isReliable: true, unavailableReason: null },
      holderConcentration: { topHolderPercentage: 46.17, top5HoldersPercentage: 59.61, top10HoldersPercentage: 70.74, semanticsNote: 'Token-account concentration.', unclassifiedTokenAccountConcentration: null },
      largestTokenAccounts: [{ address: 'Pool111111111111111111111111111111111111', percentage: 46.17, classification: { classification: 'LIQUIDITY_POOL', protocol: 'pumpswap', confidence: 'HIGH' } }],
      protocolContext: null,
      reviewSignals: [],
      inspectedAtUtc: new Date().toISOString(),
    },
    provenance: { result: 'NO_COLLISION_EVIDENCE', confidence: 'MEDIUM', scannedIdentity: { mint: 'Mint1111111111111111111111111111111111', rawName: 'The Little Hodler', normalizedName: 'the little hodler', rawSymbol: 'TLH', normalizedSymbol: 'tlh', observedAtUtc: new Date().toISOString() }, earliestObservedMatch: null, collisions: [], totalCollisionCount: 0, returnedCollisionCount: 0, isTruncated: false, evidence: [], conflictingEvidence: [], unknowns: [], analyzedAtUtc: new Date().toISOString(), onChainChronology: null, trustedIdentityProvenance: null, identityClassification: { classification: 'NO_COLLISION_EVIDENCE', confidence: 'MEDIUM', relevantCompetingMint: null, evidence: [], limitations: [] } },
    provenanceWarning: null,
  };
}

function textContent(renderer: ReturnType<typeof create>): string {
  return renderer.root.findAllByType(Text).map((node) => node.props.children).flat(Infinity).filter((value): value is string => typeof value === 'string').join(' ');
}

function renderReport(
  onExplainWithAi = vi.fn(),
): {
  renderer: ReturnType<typeof create>;
  onExplainWithAi: typeof onExplainWithAi;
  onRequestScrollTo: ReturnType<typeof vi.fn>;
  onStartTraining: ReturnType<typeof vi.fn>;
} {
  const onRequestScrollTo = vi.fn();
  const onStartTraining = vi.fn();
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <TokenAnalysisReportCard
        report={report()}
        deterministicError={null}
        aiStatus="idle"
        aiError={null}
        coach={null}
        onExplainWithAi={onExplainWithAi}
        onStartTraining={onStartTraining}
        onRequestScrollTo={onRequestScrollTo}
      />,
    );
  });
  return { renderer, onExplainWithAi, onRequestScrollTo, onStartTraining };
}

function renderExpandedReportForAiState(options: {
  aiStatus: 'idle' | 'loading' | 'unavailable' | 'ready';
  aiError?: string | null;
  coach?: TokenInspectionCoachResponse['coach'];
  onExplainWithAi?: () => void;
}) {
  const onExplainWithAi = options.onExplainWithAi ?? (() => undefined);
  let renderer!: ReturnType<typeof create>;

  act(() => {
    renderer = create(
      <TokenAnalysisReportCard
        report={report()}
        deterministicError={null}
        aiStatus={options.aiStatus}
        aiError={options.aiError ?? null}
        coach={options.coach ?? null}
        onExplainWithAi={onExplainWithAi}
        onStartTraining={vi.fn()}
        onRequestScrollTo={vi.fn()}
      />, 
    );
  });

  const buttons = () => renderer.root.findAllByType(PrimaryButton);
  const layoutWrappers = () => renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.onLayout === 'function');

  act(() => {
    layoutWrappers()[0]?.props.onLayout({ nativeEvent: { layout: { y: 100 } } });
    buttons()[1].props.onPress();
    layoutWrappers()[1]?.props.onLayout({ nativeEvent: { layout: { y: 500 } } });
  });

  return { renderer, onExplainWithAi };
}

describe('TokenAnalysisReportCard', () => {
  it('shows the summary first and keeps the full analysis collapsed by default', () => {
    const { renderer } = renderReport();
    const content = textContent(renderer);

    expect(content.indexOf('TOKEN ANALYSIS SUMMARY')).toBeGreaterThanOrEqual(0);
    expect(content).toContain('VIEW FULL ANALYSIS');
    expect(content).not.toContain('TOKEN IDENTITY');
  });

  it('does not trigger AI or training callbacks when only toggling full-analysis visibility', () => {
    const onExplainWithAi = vi.fn();
    const { renderer, onStartTraining } = renderReport(onExplainWithAi);

    act(() => {
      renderer.root.findAllByType(PrimaryButton)[1].props.onPress();
    });

    expect(onExplainWithAi).not.toHaveBeenCalled();
    expect(onStartTraining).not.toHaveBeenCalled();
  });

  it('reveals and hides the existing technical facts through one disclosure action', () => {
    const { renderer, onRequestScrollTo } = renderReport();
    const buttons = () => renderer.root.findAllByType(PrimaryButton);
    const layoutWrappers = () => renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.onLayout === 'function');

    act(() => {
      layoutWrappers()[0]?.props.onLayout({ nativeEvent: { layout: { y: 130 } } });
    });

    act(() => { buttons()[1].props.onPress(); });
    act(() => {
      layoutWrappers()[1]?.props.onLayout({ nativeEvent: { layout: { y: 620 } } });
    });

    expect(onRequestScrollTo).toHaveBeenCalledWith(620);
    expect(textContent(renderer)).toContain('TOKEN IDENTITY');
    expect(textContent(renderer)).toContain('MINT AUTHORITY');
    expect(textContent(renderer)).toContain('Revoked');
    expect(textContent(renderer)).toContain('TRUSTED IDENTITY PROVENANCE');
    expect(textContent(renderer)).toContain('HIDE FULL ANALYSIS');

    act(() => { buttons()[1].props.onPress(); });
    expect(onRequestScrollTo).toHaveBeenCalledWith(130);
    expect(textContent(renderer)).not.toContain('TOKEN IDENTITY');
    expect(textContent(renderer)).toContain('VIEW FULL ANALYSIS');
  });

  it('routes understand-the-signals into token-analysis-derived training using existing train callback', () => {
    const { renderer, onExplainWithAi, onStartTraining } = renderReport();

    act(() => { renderer.root.findAllByType(PrimaryButton)[0].props.onPress(); });

    expect(onStartTraining).toHaveBeenCalledTimes(1);
    expect(onExplainWithAi).not.toHaveBeenCalled();
  });

  it('resets expanded full-analysis disclosure when a new successful report replaces the prior result', () => {
    const { renderer } = renderReport();
    const buttons = () => renderer.root.findAllByType(PrimaryButton);

    act(() => { buttons()[1].props.onPress(); });
    expect(textContent(renderer)).toContain('HIDE FULL ANALYSIS');

    act(() => {
      renderer.update(
        <TokenAnalysisReportCard
          report={{ ...report(), inspection: { ...report().inspection, inspectedAtUtc: new Date(Date.now() + 2000).toISOString() } }}
          deterministicError={null}
          aiStatus="idle"
          aiError={null}
          coach={null}
          onExplainWithAi={vi.fn()}
          onStartTraining={vi.fn()}
          onRequestScrollTo={vi.fn()}
        />,
      );
    });

    expect(textContent(renderer)).toContain('VIEW FULL ANALYSIS');
    expect(textContent(renderer)).not.toContain('TOKEN IDENTITY');
  });

  it('shows tokenomics context separately from authority state with documentation-only confidence wording', () => {
    const issuanceContextReport: TokenAnalysisReport = {
      ...report(),
      inspection: {
        ...report().inspection,
        authorities: {
          ...report().inspection.authorities,
          mintAuthorityRevoked: false,
          mintAuthority: 'MintAuth111',
        },
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
          claims: [{
            id: 'DOCUMENTED_INFLATIONARY_ISSUANCE',
            category: 'issuance',
            statement: 'SKR has ongoing scheduled emissions.',
            verificationStatus: 'Documented',
            verificationMethod: 'DocumentationOnly',
            sourceIds: ['skr-docs'],
            observedFactReferences: [],
            verificationNote: null,
            consistency: 'Consistent',
          }],
        },
      },
    };

    const onRequestScrollTo = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={issuanceContextReport}
          deterministicError={null}
          aiStatus="idle"
          aiError={null}
          coach={null}
          onExplainWithAi={vi.fn()}
          onStartTraining={vi.fn()}
          onRequestScrollTo={onRequestScrollTo}
        />, 
      );
    });

    const buttons = () => renderer.root.findAllByType(PrimaryButton);
    const layoutWrappers = () => renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.onLayout === 'function');

    act(() => {
      layoutWrappers()[0]?.props.onLayout({ nativeEvent: { layout: { y: 120 } } });
    });
    act(() => {
      buttons()[1].props.onPress();
    });
    act(() => {
      layoutWrappers()[1]?.props.onLayout({ nativeEvent: { layout: { y: 560 } } });
    });

    const content = textContent(renderer);
    expect(content).toContain('AUTHORITIES');
    expect(content).toContain('MINT AUTHORITY');
    expect(content).toContain('Active');
    expect(content).toContain('TOKENOMICS CONTEXT');
    expect(content).toContain('Inflationary supply model');
    expect(content).toContain('Project-linked documentation describes scheduled emissions');
    expect(content).toContain('DOCUMENTED');
    expect(content).toContain('DOCUMENTATION ONLY');
    expect(content).toContain('Authority/control mechanism has not been independently verified.');
    expect(content).toContain('TOKEN ACCOUNT CONCENTRATION');
    expect(content).toContain('Token-account concentration.');
    expect(content).toContain('OPTIONAL AI SAFETY COACH');
    expect(content).toContain('does not determine token safety');
    expect(content).not.toContain('safe to buy');
  });

  it('chronology wording stays earliest-observed and does not claim token creation date', () => {
    const chronologyReport: TokenAnalysisReport = {
      ...report(),
      provenance: {
        ...report().provenance!,
        onChainChronology: {
          earliestObservedSignature: 'sig-1',
          earliestObservedSlot: 446696774,
          earliestObservedBlockTimeUtc: new Date().toISOString(),
          historyCoverage: 'PARTIAL_SIGNATURE_LIMIT',
          paginationExhausted: false,
          pagesScanned: 20,
          signaturesScanned: 4000,
          source: 'helius',
          confidence: 'LOW',
          precision: 'BLOCK_TIME',
          accountCreationProven: false,
          unknowns: [],
          analyzedAtUtc: new Date().toISOString(),
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={chronologyReport}
          deterministicError={null}
          aiStatus="idle"
          aiError={null}
          coach={null}
          onExplainWithAi={vi.fn()}
          onStartTraining={vi.fn()}
          onRequestScrollTo={vi.fn()}
        />,
      );
    });

    const buttons = () => renderer.root.findAllByType(PrimaryButton);
    const layoutWrappers = () => renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
    act(() => {
      layoutWrappers()[0]?.props.onLayout({ nativeEvent: { layout: { y: 150 } } });
      buttons()[1].props.onPress();
      layoutWrappers()[1]?.props.onLayout({ nativeEvent: { layout: { y: 520 } } });
    });

    const content = textContent(renderer);
    expect(content).toContain('CHRONOLOGY');
    expect(content).toContain('EARLIEST OBSERVED ON-CHAIN ACTIVITY');
    expect(content).not.toContain('token creation date');
  });

  it('reduces overlapping mint-supply review rows to one presentation block', () => {
    const dedupeReport: TokenAnalysisReport = {
      ...report(),
      inspection: {
        ...report().inspection,
        authorities: { ...report().inspection.authorities, mintAuthorityRevoked: false, mintAuthority: 'Auth111' },
        reviewSignals: [
          { id: 'ACTIVE_MINT_AUTHORITY', category: 'review', severity: 'medium', explanation: 'An active mint authority can increase token supply.', evidence: {} },
          { id: 'DOCUMENTED_INFLATIONARY_ISSUANCE', category: 'informational', severity: 'info', explanation: 'Ongoing inflationary issuance is documented.', evidence: {} },
        ],
        protocolContext: {
          protocol: 'solana-mobile-skr',
          sources: [],
          claims: [{
            id: 'DOCUMENTED_INFLATIONARY_ISSUANCE',
            category: 'issuance',
            statement: 'Scheduled emissions are documented.',
            verificationStatus: 'Documented',
            verificationMethod: 'DocumentationOnly',
            sourceIds: ['skr-docs'],
            observedFactReferences: [],
            verificationNote: null,
            consistency: 'Consistent',
          }],
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={dedupeReport}
          deterministicError={null}
          aiStatus="idle"
          aiError={null}
          coach={null}
          onExplainWithAi={vi.fn()}
          onStartTraining={vi.fn()}
          onRequestScrollTo={vi.fn()}
        />,
      );
    });

    const buttons = () => renderer.root.findAllByType(PrimaryButton);
    const layoutWrappers = () => renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
    act(() => {
      layoutWrappers()[0]?.props.onLayout({ nativeEvent: { layout: { y: 100 } } });
      buttons()[1].props.onPress();
      layoutWrappers()[1]?.props.onLayout({ nativeEvent: { layout: { y: 500 } } });
    });

    const content = textContent(renderer);
    expect(content).toContain('MINT SUPPLY');
    expect(content).toContain('Active authority');
    expect(content).toContain('Consistent with project-linked documented scheduled emissions.');
    expect(content).not.toContain('ACTIVE_MINT_AUTHORITY');
  });

  it('renders repeated provenance statuses with unique keys and no duplicate-key warning', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const provenanceReport: TokenAnalysisReport = {
      ...report(),
      provenance: {
        ...report().provenance!,
        trustedIdentityProvenance: {
          sources: [
            {
              url: 'https://docs.example/a',
              publisher: 'Solana Mobile',
              sourceTrust: 'TRUSTED',
              mintLinkStatus: 'NO_RELEVANT_MINT_REFERENCE',
              referencedRelevantMints: [],
              evidenceSummary: 'No mint found in source A.',
            },
            {
              url: 'https://docs.example/b',
              publisher: 'Solana Mobile',
              sourceTrust: 'TRUSTED',
              mintLinkStatus: 'NO_RELEVANT_MINT_REFERENCE',
              referencedRelevantMints: [],
              evidenceSummary: 'No mint found in source B.',
            },
          ],
          evidence: [],
          conflicts: [],
          unknowns: [],
          analyzedAtUtc: new Date().toISOString(),
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={provenanceReport}
          deterministicError={null}
          aiStatus="idle"
          aiError={null}
          coach={null}
          onExplainWithAi={vi.fn()}
          onStartTraining={vi.fn()}
          onRequestScrollTo={vi.fn()}
        />,
      );
    });

    const buttons = () => renderer.root.findAllByType(PrimaryButton);
    const layoutWrappers = () => renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
    act(() => {
      layoutWrappers()[0]?.props.onLayout({ nativeEvent: { layout: { y: 90 } } });
      buttons()[1].props.onPress();
      layoutWrappers()[1]?.props.onLayout({ nativeEvent: { layout: { y: 410 } } });
    });

    const duplicateKeyWarning = consoleErrorSpy.mock.calls
      .map((call) => call.join(' '))
      .find((message) => message.includes('Encountered two children with the same key'));

    const content = textContent(renderer);
    expect(content).toContain('NO MINT REFERENCE');

    expect(duplicateKeyWarning).toBeUndefined();
    consoleErrorSpy.mockRestore();
  });

  it('renders distinct provenance outcome states for mint matching context', () => {
    const provenanceStateReport: TokenAnalysisReport = {
      ...report(),
      provenance: {
        ...report().provenance!,
        trustedIdentityProvenance: {
          sources: [
            {
              url: 'https://docs.example/exact',
              publisher: 'Solana Mobile',
              sourceTrust: 'TRUSTED',
              mintLinkStatus: 'REFERENCES_SCANNED_MINT',
              referencedRelevantMints: ['mint'],
              evidenceSummary: 'Exact match',
            },
            {
              url: 'https://docs.example/no-reference',
              publisher: 'Solana Mobile',
              sourceTrust: 'TRUSTED',
              mintLinkStatus: 'NO_RELEVANT_MINT_REFERENCE',
              referencedRelevantMints: [],
              evidenceSummary: 'No relevant mint',
            },
            {
              url: 'https://docs.example/unavailable',
              publisher: 'Solana Mobile',
              sourceTrust: 'TRUSTED',
              mintLinkStatus: 'FETCH_UNAVAILABLE',
              referencedRelevantMints: [],
              evidenceSummary: 'Fetch unavailable',
            },
          ],
          evidence: [],
          conflicts: [],
          unknowns: [],
          analyzedAtUtc: new Date().toISOString(),
        },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={provenanceStateReport}
          deterministicError={null}
          aiStatus="idle"
          aiError={null}
          coach={null}
          onExplainWithAi={vi.fn()}
          onStartTraining={vi.fn()}
          onRequestScrollTo={vi.fn()}
        />,
      );
    });

    const buttons = () => renderer.root.findAllByType(PrimaryButton);
    const layoutWrappers = () => renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
    act(() => {
      layoutWrappers()[0]?.props.onLayout({ nativeEvent: { layout: { y: 85 } } });
      buttons()[1].props.onPress();
      layoutWrappers()[1]?.props.onLayout({ nativeEvent: { layout: { y: 470 } } });
    });

    const content = textContent(renderer);
    expect(content).toContain('EXACT MINT MATCH');
    expect(content).toContain('NO MINT REFERENCE');
    expect(content).toContain('FETCH UNAVAILABLE');
  });

  it('keeps authority facts aligned between summary and full analysis', () => {
    const activeAuthorityReport: TokenAnalysisReport = {
      ...report(),
      inspection: {
        ...report().inspection,
        authorities: { mintAuthorityRevoked: false, freezeAuthorityRevoked: true, mintAuthority: 'Auth111', freezeAuthority: null },
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={activeAuthorityReport}
          deterministicError={null}
          aiStatus="idle"
          aiError={null}
          coach={null}
          onExplainWithAi={vi.fn()}
          onStartTraining={vi.fn()}
          onRequestScrollTo={vi.fn()}
        />,
      );
    });

    let content = textContent(renderer);
    expect(content).toContain('MINT AUTHORITY');
    expect(content).toContain('Active');

    const buttons = () => renderer.root.findAllByType(PrimaryButton);
    const layoutWrappers = () => renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
    act(() => {
      layoutWrappers()[0]?.props.onLayout({ nativeEvent: { layout: { y: 105 } } });
      buttons()[1].props.onPress();
      layoutWrappers()[1]?.props.onLayout({ nativeEvent: { layout: { y: 500 } } });
    });

    content = textContent(renderer);
    expect(content).toContain('AUTHORITIES');
    expect(content).toContain('MINT AUTHORITY');
    expect(content).toContain('Active');
  });

  it('shows EXPLAIN WITH AI button in idle state', () => {
    const onExplainWithAi = vi.fn();
    const { renderer } = renderExpandedReportForAiState({ aiStatus: 'idle', onExplainWithAi });

    const content = textContent(renderer);
    expect(content).toContain('OPTIONAL AI SAFETY COACH');
    expect(content).toContain('EXPLAIN WITH AI');
    expect(content).toContain('TOKEN IDENTITY');
  });

  it('shows disabled loading AI button in loading state', () => {
    const { renderer } = renderExpandedReportForAiState({ aiStatus: 'loading' });

    const loadingButton = renderer.root
      .findAllByType(PrimaryButton)
      .find((button) => String(button.props.children).includes('LOADING AI EXPLANATION...'));

    expect(loadingButton).toBeDefined();
    expect(loadingButton!.props.disabled).toBe(true);
    expect(textContent(renderer)).toContain('TOKEN IDENTITY');
  });

  it('shows non-blocking unavailable AI state with try again and keeps deterministic facts visible', () => {
    const { renderer } = renderExpandedReportForAiState({
      aiStatus: 'unavailable',
      aiError: 'AI explanation is currently unavailable.',
    });

    const content = textContent(renderer);
    expect(content).toContain('TRY AGAIN');
    expect(content).toContain('AI explanation is currently unavailable.');
    expect(content).toContain('TOKEN IDENTITY');
    expect(content).toContain('MINT AUTHORITY');
  });

  it('renders AI educational content in ready state while preserving deterministic facts', () => {
    const { renderer } = renderExpandedReportForAiState({
      aiStatus: 'ready',
      coach: {
        summary: 'Summary for education.',
        riskExplanations: ['Why this matters item'],
        whatToCheckNext: ['Check this next'],
        uncertainty: ['Still uncertain'],
        recommendedTrainingTopicId: 'token-2022',
        coachVersion: 2,
        generatedAtUtc: new Date().toISOString(),
      },
    });

    const content = textContent(renderer);
    expect(content).toContain('SUMMARY');
    expect(content).toContain('Summary for education.');
    expect(content).toContain('WHY THIS MATTERS');
    expect(content).toContain('WHAT TO CHECK NEXT');
    expect(content).toContain('UNCERTAINTY');
    expect(content).toContain('TOKEN IDENTITY');
  });
});
