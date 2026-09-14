import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import TokenAnalysisScreen from '@/app/(tabs)/token-analysis';

const pushMock = vi.hoisted(() => vi.fn());
const useTokenAnalysisMock = vi.hoisted(() => vi.fn());
const capturedReportCardProps = vi.hoisted(() => ({
  current: null as null | {
    onStartTraining: (topic: string, exerciseId: string) => void;
    onRequestScrollTo: (y: number) => void;
  },
}));
const scrollToMock = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/hooks/useTokenAnalysis', () => ({
  useTokenAnalysis: () => useTokenAnalysisMock(),
}));

vi.mock('@/components/Screen', () => ({
  Screen: React.forwardRef(function MockScreen({ children }: { children: React.ReactNode }, ref) {
    if (typeof ref === 'function') {
      ref({ scrollTo: scrollToMock });
    } else if (ref) {
      (ref as React.MutableRefObject<{ scrollTo: typeof scrollToMock } | null>).current = { scrollTo: scrollToMock };
    }
    return React.createElement('View', null, children);
  }),
}));

vi.mock('@/components/PageHeading', () => ({
  PageHeading: () => React.createElement('View', null),
}));

vi.mock('@/components/token-analysis/TokenAnalysisInputCard', () => ({
  TokenAnalysisInputCard: () => React.createElement('View', null),
}));

vi.mock('@/components/token-analysis/TokenAnalysisReportCard', () => ({
  TokenAnalysisReportCard: (props: {
    onStartTraining: (topic: string, exerciseId: string) => void;
    onRequestScrollTo: (y: number) => void;
  }) => {
    capturedReportCardProps.current = props;
    return React.createElement('View', null);
  },
}));

vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));

describe('Token analysis screen routing', () => {
  it('routes token-analysis-derived training with explicit source semantics and forwards scroll callback', () => {
    pushMock.mockReset();
    scrollToMock.mockReset();
    useTokenAnalysisMock.mockReturnValue({
      mintInput: 'Mint1111111111111111111111111111111111',
      setMintInput: vi.fn(),
      deterministicStatus: 'ready',
      aiStatus: 'idle',
      report: {
        mint: 'Mint1111111111111111111111111111111111',
        inspection: {
          identity: { mint: 'Mint1111111111111111111111111111111111', name: 'Token', symbol: 'TOK' },
          authorities: { mintAuthorityRevoked: true, freezeAuthorityRevoked: true, mintAuthority: null, freezeAuthority: null },
          program: { programId: 'Tokenkeg', programType: 'spl-token' },
          age: { ageSeconds: 1, isReliable: true, unavailableReason: null },
          holderConcentration: { topHolderPercentage: 10, top5HoldersPercentage: 20, top10HoldersPercentage: 30, semanticsNote: 'note', unclassifiedTokenAccountConcentration: null },
          largestTokenAccounts: [],
          reviewSignals: [],
          inspectedAtUtc: new Date().toISOString(),
        },
        provenance: null,
        provenanceWarning: null,
      },
      coach: null,
      validationError: null,
      deterministicError: null,
      aiError: null,
      analyzeToken: vi.fn(),
      explainWithAi: vi.fn(),
      clearInput: vi.fn(),
    });

    act(() => {
      create(<TokenAnalysisScreen />);
    });

    capturedReportCardProps.current?.onStartTraining('token-2022', 'wallet-lesson-token-2022-program');
    capturedReportCardProps.current?.onRequestScrollTo(240);

    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/train',
      params: {
        mode: 'practice',
        source: 'token-analysis',
        topic: 'token-2022',
        exerciseId: 'wallet-lesson-token-2022-program',
      },
    });
    expect(scrollToMock).toHaveBeenCalledWith({ y: 232, animated: true });
  });
});
