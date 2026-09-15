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

function report(): TokenAnalysisReport {
  return {
    mint: 'Mint1111111111111111111111111111111111',
    inspection: {
      identity: { mint: 'Mint1111111111111111111111111111111111', name: 'The Little Hodler', symbol: 'TLH' },
      authorities: { mintAuthorityRevoked: true, freezeAuthorityRevoked: true, mintAuthority: null, freezeAuthority: null },
      program: { programId: 'TokenzQd', programType: 'token-2022' },
      age: { ageSeconds: 1, isReliable: true, unavailableReason: null },
      holderConcentration: { topHolderPercentage: 46.17, top5HoldersPercentage: 59.61, top10HoldersPercentage: 70.74, semanticsNote: 'Token-account concentration.', unclassifiedTokenAccountConcentration: null },
      largestTokenAccounts: [
        { address: 'Pool111111111111111111111111111111111111', percentage: 46.17, classification: { classification: 'LIQUIDITY_POOL', protocol: 'pumpswap', confidence: 'HIGH' } },
        { address: 'Holder21111111111111111111111111111111111', percentage: 8.12, classification: { classification: 'UNKNOWN', protocol: null, confidence: 'LOW' } },
      ],
      protocolContext: null,
      reviewSignals: [],
      inspectedAtUtc: new Date().toISOString(),
    },
    provenance: null,
    provenanceWarning: null,
  };
}

function coach(): NonNullable<TokenInspectionCoachResponse['coach']> {
  return {
    summary: 'summary',
    riskExplanations: ['risk one', 'risk two'],
    whatToCheckNext: ['check one'],
    uncertainty: ['unknown one'],
    recommendedTrainingTopicId: null,
    coachVersion: 2,
    generatedAtUtc: new Date().toISOString(),
  };
}

function textContent(renderer: ReturnType<typeof create>): string {
  return renderer.root.findAllByType(Text).map((node) => node.props.children).flat(Infinity).filter((value): value is string => typeof value === 'string').join(' ');
}

describe('TokenAnalysisReportCard', () => {
  it('renders summary, distribution, and AI coach without full analysis controls', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={report()}
          deterministicError={null}
          aiStatus="loading"
          aiError={null}
          coach={null}
          onRetryAi={vi.fn()}
          onStartTraining={vi.fn()}
        />,
      );
    });

    const content = textContent(renderer);
    expect(content).toContain('TOKEN ANALYSIS SUMMARY');
    expect(content).toContain('TOKEN DISTRIBUTION (TOP 5 ACCOUNTS)');
    expect(content).toContain('AI SAFETY COACH');
    expect(content).toContain('LOADING AI EXPLANATION...');
    expect(content).not.toContain('EXPLAIN WITH AI');
    expect(content).not.toContain('VIEW FULL ANALYSIS');
    expect(content).not.toContain('HIDE FULL ANALYSIS');
    expect(content).not.toContain('IDENTITY CLASSIFICATION');
  });

  it('renders top account context using backend classification without inventing labels', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={report()}
          deterministicError={null}
          aiStatus="idle"
          aiError={null}
          coach={null}
          onRetryAi={vi.fn()}
          onStartTraining={vi.fn()}
        />,
      );
    });

    const content = textContent(renderer);
    expect(content).toContain('PumpSwap LP');
    expect(content).toContain('Unclassified account context');
    expect(content).toContain('46.17%');
    expect(content).toContain('8.12%');
    expect(content).toContain('Token-account concentration.');
    expect(content).not.toContain('Pool111111111111111111111111111111111111');
  });

  it('shows TRY AGAIN only when AI is unavailable and invokes retry callback', () => {
    const onRetryAi = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={report()}
          deterministicError={null}
          aiStatus="unavailable"
          aiError="AI timeout"
          coach={null}
          onRetryAi={onRetryAi}
          onStartTraining={vi.fn()}
        />,
      );
    });

    const retryButton = renderer.root.findAllByType(PrimaryButton)
      .find((button) => String(button.props.children).includes('TRY AGAIN'));

    expect(retryButton).toBeDefined();
    act(() => {
      retryButton?.props.onPress();
    });

    expect(onRetryAi).toHaveBeenCalledTimes(1);
    expect(textContent(renderer)).toContain('AI timeout');
  });

  it('renders AI bullet sections when coach content is ready', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAnalysisReportCard
          report={report()}
          deterministicError={null}
          aiStatus="ready"
          aiError={null}
          coach={coach()}
          onRetryAi={vi.fn()}
          onStartTraining={vi.fn()}
        />,
      );
    });

    const content = textContent(renderer);
    expect(content).toContain('WHY THIS MATTERS');
    expect(content).toContain('WHAT TO CHECK NEXT');
    expect(content).toContain('UNCERTAINTY');
    expect(content).toContain('risk one');
    expect(content).toContain('check one');
    expect(content).toContain('unknown one');
  });
});
