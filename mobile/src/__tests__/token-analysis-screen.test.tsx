import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import TokenAnalysisScreen from '@/app/(tabs)/token-analysis';

const pushMock = vi.hoisted(() => vi.fn());
const useTokenAnalysisMock = vi.hoisted(() => vi.fn());
const capturedReportCardProps = vi.hoisted(() => ({
  current: null as null | {
    onStartTraining: (topic: string, exerciseId: string) => void;
  },
}));
const capturedInputCardProps = vi.hoisted(() => ({
  current: null as null | {
    onAnalyze: () => void;
    onClear: () => void;
  },
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
  useLocalSearchParams: () => ({}),
}));

vi.mock('@/hooks/useTokenAnalysis', () => ({
  useTokenAnalysis: () => useTokenAnalysisMock(),
}));

vi.mock('@/components/Screen', () => ({
  Screen: React.forwardRef(function MockScreen({ children }: { children: React.ReactNode }, ref) {
    if (typeof ref === 'function') {
      ref(null);
    } else if (ref) {
      (ref as React.MutableRefObject<null>).current = null;
    }
    return React.createElement('View', null, children);
  }),
}));

vi.mock('@/components/PageHeading', () => ({
  PageHeading: () => React.createElement('View', null),
}));

vi.mock('@/components/token-analysis/TokenAnalysisInputCard', () => ({
  TokenAnalysisInputCard: (props: {
    deterministicStatus: 'idle' | 'validating' | 'loadingInspection' | 'loadingProvenance' | 'ready' | 'error';
    onAnalyze: () => void;
    onClear: () => void;
  }) => {
    capturedInputCardProps.current = props;
    const label = props.deterministicStatus === 'loadingInspection'
      ? 'ANALYZING TOKEN...'
      : props.deterministicStatus === 'loadingProvenance'
        ? 'LOADING PROVENANCE...'
        : props.deterministicStatus === 'validating'
          ? 'VALIDATING...'
          : 'ANALYZE TOKEN';
    return React.createElement('View', null, React.createElement('Text', null, 'INPUT_CARD'), React.createElement('Text', null, label));
  },
}));

vi.mock('@/components/token-analysis/TokenAnalysisReportCard', () => ({
  TokenAnalysisReportCard: (props: {
    onStartTraining: (topic: string, exerciseId: string) => void;
  }) => {
    capturedReportCardProps.current = props;
    return React.createElement('Text', null, 'REPORT_CARD');
  },
}));

vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => React.createElement('Pressable', { onPress }, React.createElement('Text', null, children)),
}));

vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));

describe('Token analysis screen routing', () => {
  function createController(overrides: Partial<ReturnType<typeof useTokenAnalysisMock>> = {}) {
    return {
      mintInput: 'Mint1111111111111111111111111111111111',
      setMintInput: vi.fn(),
      deterministicStatus: 'idle',
      aiStatus: 'idle',
      report: null,
      coach: null,
      validationError: null,
      deterministicError: null,
      aiError: null,
      analyzeToken: vi.fn(),
      explainWithAi: vi.fn(),
      clearInput: vi.fn(),
      ...overrides,
    };
  }

  it('initial state shows input and analyze button, without report', () => {
    const controller = createController({ mintInput: '', deterministicStatus: 'idle', report: null });
    useTokenAnalysisMock.mockReturnValue(controller);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenAnalysisScreen />);
    });

    const text = renderer.root.findAll((node) => String(node.type) === 'Text').map((node) => String(node.props.children ?? '')).join(' ');
    expect(text).toContain('INPUT_CARD');
    expect(text).toContain('ANALYZE TOKEN');
    expect(text).not.toContain('REPORT_CARD');
  });

  it('loading state keeps input/loading visible and hides stale report', () => {
    const controller = createController({
      deterministicStatus: 'loadingInspection',
      report: {
        mint: 'OldMint1111111111111111111111111111111111',
        inspection: {
          identity: { mint: 'OldMint1111111111111111111111111111111111', name: 'Old Token', symbol: 'OLD' },
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
    });
    useTokenAnalysisMock.mockReturnValue(controller);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenAnalysisScreen />);
    });

    const text = renderer.root.findAll((node) => String(node.type) === 'Text').map((node) => String(node.props.children ?? '')).join(' ');
    expect(text).toContain('INPUT_CARD');
    expect(text).toContain('ANALYZING TOKEN...');
    expect(text).not.toContain('REPORT_CARD');
  });

  it('successful analysis shows report-only state with compact home action', () => {
    const controller = createController({
      deterministicStatus: 'ready',
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
    });
    useTokenAnalysisMock.mockReturnValue(controller);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenAnalysisScreen />);
    });

    const text = renderer.root.findAll((node) => String(node.type) === 'Text').map((node) => String(node.props.children ?? '')).join(' ');
    expect(text).toContain('REPORT_CARD');
    expect(text).toContain('< HOME');
    expect(text).not.toContain('INPUT_CARD');
    expect(text).not.toContain('ANALYZE TOKEN');
  });

  it('compact home action routes to home from result state', () => {
    pushMock.mockReset();
    useTokenAnalysisMock.mockReturnValue(createController({
      deterministicStatus: 'ready',
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
    }));

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenAnalysisScreen />);
    });

    const homeButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')
      .find((node) => String(node.props.children?.props?.children ?? '').includes('< HOME'));
    expect(homeButton).toBeDefined();

    act(() => {
      homeButton?.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('routes token-analysis-derived training with explicit source semantics', () => {
    pushMock.mockReset();
    useTokenAnalysisMock.mockReturnValue(createController({
      deterministicStatus: 'ready',
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
    }));

    act(() => {
      create(<TokenAnalysisScreen />);
    });

    capturedReportCardProps.current?.onStartTraining('token-2022', 'wallet-lesson-token-2022-program');

    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/train',
      params: {
        mode: 'practice',
        source: 'token-analysis',
        topic: 'token-2022',
        exerciseId: 'wallet-lesson-token-2022-program',
      },
    });
  });
});
