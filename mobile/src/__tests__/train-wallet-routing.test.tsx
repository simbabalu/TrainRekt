import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import TrainScreen from '@/app/(tabs)/train';

const useLocalSearchParamsMock = vi.hoisted(() => vi.fn());
const useTrainingScenarioMock = vi.hoisted(() => vi.fn());
const useTrainingProgressMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const routerBackMock = vi.hoisted(() => vi.fn());

Object.defineProperty(globalThis, '__DEV__', {
  value: false,
  configurable: true,
});
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (callback: () => void) => callback(),
  configurable: true,
});

const scrollToMock = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({
  useLocalSearchParams: useLocalSearchParamsMock,
  useRouter: () => ({ replace: routerReplaceMock, back: routerBackMock }),
}));

vi.mock('@/hooks/useTrainingScenario', () => ({
  useTrainingScenario: useTrainingScenarioMock,
}));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: () => useTrainingProgressMock() ?? {
      progress: {
      level: 1,
      xpIntoCurrentLevel: 0,
      xpRequiredForNextLevel: 1000,
      xpToNextLevel: 1000,
      winRate: 50,
      totalXp: 100,
      sessionsCompleted: 0,
      correctDecisions: 0,
      wrongDecisions: 0,
      currentStreak: 0,
      bestStreak: 0,
      skillScores: {
        riskManagement: 50,
        profitTaking: 50,
        fomoResistance: 50,
        positionSizing: 50,
        scamAwareness: 50,
        leverageRisk: 50,
        panicSelling: 50,
        marketInterpretation: 50,
        walletSafety: 50,
      },
      recentTrainingHistory: [],
      daily: {
        dailyGoal: 3,
        todayCompletedDecisions: 0,
        todayDateKey: '2026-09-11',
        dailyGoalCompleted: false,
        lastDailyCompletionDate: null,
        dailyTrainingStreak: 0,
        bestDailyTrainingStreak: 0,
      },
      surpriseChallenges: { completed: {} },
      badges: { earned: {} },
      },
    },
}));

vi.mock('@/components/Screen', () => ({
  Screen: React.forwardRef(function ScreenMock({ children }: { children: React.ReactNode }, ref) {
    if (typeof ref === 'function') ref({ scrollTo: scrollToMock });
    else if (ref && 'current' in ref) (ref as React.MutableRefObject<unknown>).current = { scrollTo: scrollToMock };
    return children;
  }),
}));
vi.mock('@/components/TrainingModeHeader', () => ({
  TrainingModeHeader: () => React.createElement('Text', null, 'MODE_HEADER'),
}));
vi.mock('@/components/AppIcon', () => ({
  AppIcon: () => null,
}));
vi.mock('@/components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));
vi.mock('@/components/DecisionExerciseView', () => ({ DecisionExerciseView: () => null }));
vi.mock('@/components/SignatureSimulationView', () => ({ SignatureSimulationView: () => null }));
vi.mock('@/components/TransactionInspectionView', () => ({ TransactionInspectionView: () => null }));
vi.mock('@/components/PermissionChallengeView', () => ({ PermissionChallengeView: () => null }));
vi.mock('@/components/ScamDetectionView', () => ({ ScamDetectionView: () => null }));
vi.mock('@/components/RedFlagIdentificationView', () => ({ RedFlagIdentificationView: () => null }));
vi.mock('@/components/DecisionResultPanel', () => ({ DecisionResultPanel: () => React.createElement('Text', null, 'RESULT PANEL') }));
vi.mock('@/components/DailyGoalInlineStatus', () => ({ DailyGoalInlineStatus: () => null }));
vi.mock('@/components/DailyTrainingCompleteCard', () => ({ DailyTrainingCompleteCard: () => null }));
vi.mock('@/components/CompletedDailyTrainingState', () => ({ CompletedDailyTrainingState: () => React.createElement('Text', null, 'TODAY COMPLETE') }));
vi.mock('@/components/PrimaryButton', () => ({ PrimaryButton: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => React.createElement('Pressable', { onPress }, React.createElement('Text', null, children)) }));
vi.mock('@/data/exerciseCatalog', () => ({ exerciseCatalog: [] }));
vi.mock('@/data/permissionChallengeCatalog', () => ({ permissionChallengeCatalog: [] }));
vi.mock('@/data/redFlagIdentificationCatalog', () => ({ redFlagIdentificationCatalog: [] }));
vi.mock('@/data/scamDetectionCatalog', () => ({ scamDetectionCatalog: [] }));
vi.mock('@/data/transactionInspectionCatalog', () => ({ transactionInspectionCatalog: [] }));

vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

describe('Train wallet routing', () => {
  it('scrolls once to newly rendered feedback and keeps next exercise manual', () => {
    const nextExercise = vi.fn();
    scrollToMock.mockReset();
    useLocalSearchParamsMock.mockReturnValue({ mode: 'practice' });
    useTrainingScenarioMock.mockReturnValue({
      currentExercise: { id: 'practice-exercise', type: 'transaction-inspection', skill: 'walletSafety', difficulty: 'Beginner' },
      selectedAnswer: 'inspect',
      result: { title: 'Good decision', isCorrect: true, xpEarned: 20, explanation: 'Explanation' },
      submitAnswer: vi.fn(),
      nextExercise,
      debugSelectExercise: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainScreen />);
    });

    const resultAnchor = renderer.root.findAll((node) => typeof node.props.onLayout === 'function').at(-1);
    act(() => resultAnchor?.props.onLayout({ nativeEvent: { layout: { y: 100 } } }));
    act(() => resultAnchor?.props.onLayout({ nativeEvent: { layout: { y: 100 } } }));

    expect(scrollToMock).toHaveBeenCalledTimes(1);
    expect(scrollToMock).toHaveBeenCalledWith({ y: 88, animated: true });

    const nextButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')
      .find((node) => String(node.props.children?.props?.children ?? '').includes('NEXT EXERCISE'));
    act(() => nextButton?.props.onPress());
    expect(nextExercise).toHaveBeenCalledTimes(1);
  });

  it('scrolls again when a new answered exercise renders feedback', () => {
    scrollToMock.mockReset();
    useLocalSearchParamsMock.mockReturnValue({ mode: 'practice' });
    const scenario = {
      currentExercise: { id: 'practice-exercise', type: 'transaction-inspection' as const, skill: 'walletSafety' as const, difficulty: 'Beginner' as const },
      selectedAnswer: 'inspect' as const,
      result: { title: 'Risky decision', isCorrect: false, xpEarned: 0, explanation: 'Explanation' },
      submitAnswer: vi.fn(),
      nextExercise: vi.fn(),
      debugSelectExercise: vi.fn(),
    };
    useTrainingScenarioMock.mockReturnValue(scenario);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainScreen />);
    });
    const firstAnchor = renderer.root.findAll((node) => typeof node.props.onLayout === 'function').at(-1);
    act(() => firstAnchor?.props.onLayout({ nativeEvent: { layout: { y: 120 } } }));

    scenario.currentExercise = { ...scenario.currentExercise, id: 'next-exercise' };
    scenario.result = { ...scenario.result, title: 'Good decision', isCorrect: true, xpEarned: 20 };
    act(() => renderer.update(<TrainScreen />));
    const secondAnchor = renderer.root.findAll((node) => typeof node.props.onLayout === 'function').at(-1);
    act(() => secondAnchor?.props.onLayout({ nativeEvent: { layout: { y: 160 } } }));

    expect(scrollToMock).toHaveBeenCalledTimes(2);
    expect(scrollToMock).toHaveBeenLastCalledWith({ y: 148, animated: true });
  });

  it('forces wallet route entries into practice mode and passes wallet topic/exercise into useTrainingScenario', () => {
    useLocalSearchParamsMock.mockReturnValue({
      mode: 'daily',
      source: 'wallet',
      topic: 'token-account-state',
      exerciseId: 'wallet-lesson-frozen-account-state',
    });
    useTrainingScenarioMock.mockReturnValue({
      currentExercise: {
        id: 'wallet-lesson-frozen-account-state',
        type: 'transaction-inspection',
        skill: 'walletSafety',
        difficulty: 'Beginner',
      },
      selectedAnswer: null,
      result: null,
      submitAnswer: vi.fn(),
      nextExercise: vi.fn(),
      debugSelectExercise: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainScreen />);
    });

    expect(useTrainingScenarioMock).toHaveBeenCalledTimes(1);
    expect(useTrainingScenarioMock).toHaveBeenCalledWith('practice', {
      source: 'wallet',
      topic: 'token-account-state',
      initialExerciseId: 'wallet-lesson-frozen-account-state',
    });

    const text = renderer.root.findAll((node) => String(node.type) === 'Text').map((node) => String(node.props.children ?? '')).join(' ');
    expect(text).not.toContain('DEV EXERCISE PICKER');
  });

  it('returns a completed wallet lesson to Wallet Safety without selecting another exercise', () => {
    const nextExercise = vi.fn();
    routerReplaceMock.mockReset();
    useLocalSearchParamsMock.mockReturnValue({
      mode: 'practice',
      source: 'wallet',
      topic: 'token-account-state',
      exerciseId: 'wallet-lesson-frozen-account-state',
    });
    useTrainingScenarioMock.mockReturnValue({
      currentExercise: {
        id: 'wallet-lesson-frozen-account-state',
        type: 'transaction-inspection',
        skill: 'walletSafety',
        difficulty: 'Beginner',
      },
      selectedAnswer: 'inspect',
      result: { title: 'Result', isCorrect: true, xpEarned: 5, explanation: 'Explanation' },
      submitAnswer: vi.fn(),
      nextExercise,
      debugSelectExercise: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainScreen />);
    });

    const backButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')
      .find((node) => String(node.props.children?.props?.children ?? '').includes('BACK TO WALLET SAFETY'));
    expect(backButton).toBeDefined();
    act(() => backButton?.props.onPress());

    expect(routerReplaceMock).toHaveBeenCalledWith('/wallet-safety');
    expect(nextExercise).not.toHaveBeenCalled();
  });

  it('keeps NEXT EXERCISE for ordinary practice sessions', () => {
    const nextExercise = vi.fn();
    useLocalSearchParamsMock.mockReturnValue({ mode: 'practice' });
    useTrainingScenarioMock.mockReturnValue({
      currentExercise: { id: 'practice-exercise', type: 'transaction-inspection', skill: 'walletSafety', difficulty: 'Beginner' },
      selectedAnswer: 'inspect',
      result: { title: 'Result', isCorrect: true, xpEarned: 20, explanation: 'Explanation' },
      submitAnswer: vi.fn(),
      nextExercise,
      debugSelectExercise: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainScreen />);
    });

    const nextButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')
      .find((node) => String(node.props.children?.props?.children ?? '').includes('NEXT EXERCISE'));
    expect(nextButton).toBeDefined();
    act(() => nextButton?.props.onPress());

    expect(nextExercise).toHaveBeenCalledTimes(1);
    expect(routerReplaceMock).not.toHaveBeenCalledWith('/wallet-safety');
  });

  it('routes token-analysis source entries into guided practice and returns to token analysis on completion', () => {
    const nextExercise = vi.fn();
    routerBackMock.mockReset();
    routerReplaceMock.mockReset();
    useLocalSearchParamsMock.mockReturnValue({
      mode: 'practice',
      source: 'token-analysis',
      topic: 'token-2022',
      exerciseId: 'wallet-lesson-token-2022-program',
    });
    useTrainingScenarioMock.mockReturnValue({
      currentExercise: {
        id: 'wallet-lesson-token-2022-program',
        type: 'transaction-inspection',
        skill: 'walletSafety',
        difficulty: 'Beginner',
      },
      selectedAnswer: 'inspect',
      result: { title: 'Result', isCorrect: true, xpEarned: 5, explanation: 'Explanation' },
      submitAnswer: vi.fn(),
      nextExercise,
      debugSelectExercise: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainScreen />);
    });

    expect(useTrainingScenarioMock).toHaveBeenCalledWith('practice', {
      source: 'token-analysis',
      topic: 'token-2022',
      initialExerciseId: 'wallet-lesson-token-2022-program',
    });

    const backButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')
      .find((node) => String(node.props.children?.props?.children ?? '').includes('BACK TO TOKEN ANALYSIS'));
    expect(backButton).toBeDefined();

    act(() => backButton?.props.onPress());

    expect(routerBackMock).toHaveBeenCalledTimes(1);
    expect(routerReplaceMock).not.toHaveBeenCalledWith('/wallet-safety');
    expect(nextExercise).not.toHaveBeenCalled();
  });

  it('renders completed-day state without mounting an exercise session on re-entry', () => {
    useLocalSearchParamsMock.mockReturnValue({ mode: 'daily' });
    useTrainingScenarioMock.mockReset();
    useTrainingProgressMock.mockReturnValue({
      progress: {
        daily: {
          dailyGoal: 3,
          todayCompletedDecisions: 3,
          todayDateKey: '2026-09-11',
          dailyGoalCompleted: true,
          lastDailyCompletionDate: '2026-09-11',
          dailyTrainingStreak: 2,
          bestDailyTrainingStreak: 2,
        },
      },
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainScreen />);
    });

    expect(useTrainingScenarioMock).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => String(node.type) === 'Text').map((node) => String(node.props.children ?? '')).join(' ')).toContain('TODAY COMPLETE');
  });
});
