import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TokenAnalysisScreen, { __resetTokenAnalysisShareStateForTests } from '@/app/(tabs)/token-analysis';

const useLocalSearchParamsMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const useTokenAnalysisMock = vi.hoisted(() => vi.fn());
const capturedInputCardProps = vi.hoisted(() => ({
  current: null as null | {
    onAnalyze: () => void;
    onChangeMint: (value: string) => void;
    onClear: () => void;
    inlineNotice?: string | null;
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
  useLocalSearchParams: () => useLocalSearchParamsMock(),
}));

vi.mock('@/hooks/useTokenAnalysis', () => ({
  useTokenAnalysis: () => useTokenAnalysisMock(),
}));

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));

vi.mock('@/components/PageHeading', () => ({
  PageHeading: () => React.createElement('View', null),
}));

vi.mock('@/components/token-analysis/TokenAnalysisInputCard', () => ({
  TokenAnalysisInputCard: (props: {
    onAnalyze: () => void;
    onChangeMint: (value: string) => void;
    onClear: () => void;
    inlineNotice?: string | null;
  }) => {
    capturedInputCardProps.current = props;
    return React.createElement('View', null);
  },
}));

vi.mock('@/components/token-analysis/TokenAnalysisReportCard', () => ({
  TokenAnalysisReportCard: () => React.createElement('View', null),
}));

vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
}));

function createController() {
  return {
    mintInput: '',
    setMintInput: vi.fn(),
    deterministicStatus: 'idle',
    aiStatus: 'idle',
    report: null,
    coach: null,
    validationError: null,
    deterministicError: null,
    aiError: null,
    analyzeToken: vi.fn().mockResolvedValue(undefined),
    explainWithAi: vi.fn().mockResolvedValue(undefined),
    clearInput: vi.fn(),
  };
}

describe('Token analysis share intent behavior', () => {
  beforeEach(() => {
    pushMock.mockReset();
    useLocalSearchParamsMock.mockReset();
    useTokenAnalysisMock.mockReset();
    capturedInputCardProps.current = null;
    __resetTokenAnalysisShareStateForTests();
  });

  it('prefills mint for a valid shared mint', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);
    useLocalSearchParamsMock.mockReturnValue({
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      shareEventId: 'event-1',
    });

    act(() => {
      create(<TokenAnalysisScreen />);
    });

    expect(controller.setMintInput).toHaveBeenCalledWith('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');
  });

  it('auto-analyzes once for a valid shared mint event', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);
    useLocalSearchParamsMock.mockReturnValue({
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      shareEventId: 'event-2',
      autoAnalyze: '1',
    });

    act(() => {
      create(<TokenAnalysisScreen />);
    });

    expect(controller.analyzeToken).toHaveBeenCalledTimes(1);
    expect(controller.analyzeToken).toHaveBeenCalledWith('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');
  });

  it('does not auto-analyze again on rerender with the same params', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);
    useLocalSearchParamsMock.mockReturnValue({
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      shareEventId: 'event-3',
      autoAnalyze: '1',
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenAnalysisScreen />);
    });
    act(() => {
      renderer.update(<TokenAnalysisScreen />);
    });

    expect(controller.analyzeToken).toHaveBeenCalledTimes(1);
  });

  it('does not auto-analyze again for a duplicate shareEventId after remount', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);
    useLocalSearchParamsMock.mockReturnValue({
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      shareEventId: 'event-4',
      autoAnalyze: '1',
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenAnalysisScreen />);
    });
    act(() => {
      renderer.unmount();
    });
    act(() => {
      create(<TokenAnalysisScreen />);
    });

    expect(controller.analyzeToken).toHaveBeenCalledTimes(1);
  });

  it('auto-analyzes for a new shareEventId', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);

    let params = {
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      shareEventId: 'event-5a',
      autoAnalyze: '1',
    };

    useLocalSearchParamsMock.mockImplementation(() => params);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenAnalysisScreen />);
    });

    params = {
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      shareEventId: 'event-5b',
      autoAnalyze: '1',
    };

    act(() => {
      renderer.update(<TokenAnalysisScreen />);
    });

    expect(controller.analyzeToken).toHaveBeenCalledTimes(2);
  });

  it('shows invalid-share notice and does not auto-analyze', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);
    useLocalSearchParamsMock.mockReturnValue({
      shareStatus: 'invalid',
      shareEventId: 'event-6',
    });

    act(() => {
      create(<TokenAnalysisScreen />);
    });

    expect(controller.analyzeToken).not.toHaveBeenCalled();
    expect(capturedInputCardProps.current?.inlineNotice).toBe("TrainRekt couldn't find a Solana token address in the shared content.");
  });

  it('shows multiple-candidates notice and does not auto-analyze', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);
    useLocalSearchParamsMock.mockReturnValue({
      shareStatus: 'multiple',
      shareEventId: 'event-7',
    });

    act(() => {
      create(<TokenAnalysisScreen />);
    });

    expect(controller.analyzeToken).not.toHaveBeenCalled();
    expect(capturedInputCardProps.current?.inlineNotice).toBe('Multiple Solana addresses were found. Paste or enter the token mint you want to inspect.');
  });

  it('keeps manual analysis functional after share logic is present', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);
    useLocalSearchParamsMock.mockReturnValue({});

    act(() => {
      create(<TokenAnalysisScreen />);
    });

    act(() => {
      capturedInputCardProps.current?.onAnalyze();
    });

    expect(controller.analyzeToken).toHaveBeenCalledTimes(1);
    expect(controller.analyzeToken).toHaveBeenCalledWith();
  });

  it('keeps normal non-share behavior unchanged', () => {
    const controller = createController();
    useTokenAnalysisMock.mockReturnValue(controller);
    useLocalSearchParamsMock.mockReturnValue({});

    act(() => {
      create(<TokenAnalysisScreen />);
    });

    expect(controller.setMintInput).not.toHaveBeenCalled();
    expect(controller.analyzeToken).not.toHaveBeenCalled();
    expect(capturedInputCardProps.current?.inlineNotice ?? null).toBeNull();
  });
});
