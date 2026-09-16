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
  it('keeps identity and deterministic findings visible while key takeaways load', () => {
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
  expect(content).toContain('TOKEN IDENTITY');
  expect(content).toContain('The Little Hodler');
  expect(content).not.toContain('NO REVIEW SIGNALS');
  expect(content).not.toContain('NEEDS REVIEW');
  expect(content).toContain('KEY TAKEAWAYS');
  expect(content).toContain('Loading key takeaways...');
  expect(content).toContain('ON-CHAIN SUMMARY');
  expect(content).toContain('MINT AUTHORITY');
  expect(content).toContain('TOKEN PROGRAM');
    expect(content).toContain('TOKEN DISTRIBUTION (TOP 5 ACCOUNTS)');
  expect(content).not.toContain('AI SAFETY COACH');
  expect(content).not.toContain('AI explains verified TrainRekt findings');
  expect(content).not.toContain('TRY AGAIN');
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
    const content = textContent(renderer);
    expect(content).toContain('AI timeout');
    expect(content).toContain('TOKEN IDENTITY');
    expect(content).not.toContain('NO REVIEW SIGNALS');
    expect(content).not.toContain('NEEDS REVIEW');
    expect(content).toContain('ON-CHAIN SUMMARY');
    expect(content).toContain('MINT AUTHORITY');
    expect(content).toContain('TOKEN DISTRIBUTION (TOP 5 ACCOUNTS)');
    expect(content).not.toContain('AI SAFETY COACH');
  });

  it('renders AI summary and existing guidance in the requested report order', () => {
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
    expect(content).toContain('KEY TAKEAWAYS');
    expect(content).toContain('summary');
    expect(content).toContain('ON-CHAIN SUMMARY');
    expect(content).toContain('TOKEN DISTRIBUTION (TOP 5 ACCOUNTS)');
    expect(content).toContain('KEY POINTS');
    expect(content).toContain('WHAT TO CHECK NEXT');
    expect(content).toContain('risk one');
    expect(content).toContain('check one');
    expect(content).not.toContain('TRY AGAIN');
    expect(content).not.toContain('AI SAFETY COACH');
    expect(content).not.toContain('AI explains verified TrainRekt findings');
    expect(content.indexOf('TOKEN IDENTITY')).toBeLessThan(content.indexOf('KEY TAKEAWAYS'));
    expect(content.indexOf('KEY TAKEAWAYS')).toBeLessThan(content.indexOf('ON-CHAIN SUMMARY'));
    expect(content.indexOf('ON-CHAIN SUMMARY')).toBeLessThan(content.indexOf('TOKEN DISTRIBUTION (TOP 5 ACCOUNTS)'));
    expect(content.indexOf('TOKEN DISTRIBUTION (TOP 5 ACCOUNTS)')).toBeLessThan(content.indexOf('KEY POINTS'));
    expect(content.indexOf('KEY POINTS')).toBeLessThan(content.indexOf('WHAT TO CHECK NEXT'));
  });
});
