import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import TrainScreen from '@/app/(tabs)/train';

const useLocalSearchParamsMock = vi.hoisted(() => vi.fn());
const useTrainingScenarioMock = vi.hoisted(() => vi.fn());
const useTrainingProgressMock = vi.hoisted(() => vi.fn());

Object.defineProperty(globalThis, '__DEV__', {
  value: false,
  configurable: true,
});

vi.mock('expo-router', () => ({
  useLocalSearchParams: useLocalSearchParamsMock,
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
  Screen: ({ children }: { children: React.ReactNode }) => children,
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
vi.mock('@/components/DecisionResultPanel', () => ({ DecisionResultPanel: () => null }));
vi.mock('@/components/DailyGoalInlineStatus', () => ({ DailyGoalInlineStatus: () => null }));
vi.mock('@/components/DailyTrainingCompleteCard', () => ({ DailyTrainingCompleteCard: () => null }));
vi.mock('@/components/CompletedDailyTrainingState', () => ({ CompletedDailyTrainingState: () => React.createElement('Text', null, 'TODAY COMPLETE') }));
vi.mock('@/components/PrimaryButton', () => ({ PrimaryButton: ({ children }: { children: React.ReactNode }) => React.createElement('Text', null, children) }));
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
