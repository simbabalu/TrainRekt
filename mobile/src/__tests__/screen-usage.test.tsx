import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import HomeScreen from '@/app/(tabs)/index';
import TrainScreen from '@/app/(tabs)/train';
import ProgressScreen from '@/app/(tabs)/explore';
import SettingsScreen from '@/app/(tabs)/settings';

Object.defineProperty(globalThis, '__DEV__', {
  value: false,
  configurable: true,
});

vi.mock('expo-router', () => ({
  Link: 'Link',
  useRouter: () => ({ push: vi.fn() }),
  useLocalSearchParams: () => ({}),
}));

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => (
    <>
      <TextStub value="SCREEN_WRAPPER" />
      {children}
    </>
  ),
}));

vi.mock('@/components/LevelProgressCard', () => ({ LevelProgressCard: () => null }));
vi.mock('@/components/DailyGoalCard', () => ({ DailyGoalCard: () => null }));
vi.mock('@/components/PrimaryButton', () => ({ PrimaryButton: ({ children }: { children: React.ReactNode }) => React.createElement('Text', null, children) }));
vi.mock('@/components/DailyGoalInlineStatus', () => ({ DailyGoalInlineStatus: () => null }));
vi.mock('@/components/DailyTrainingCompleteCard', () => ({ DailyTrainingCompleteCard: () => null }));
vi.mock('@/components/DecisionExerciseView', () => ({ DecisionExerciseView: () => null }));
vi.mock('@/components/DecisionResultPanel', () => ({ DecisionResultPanel: () => null }));
vi.mock('@/components/SignatureSimulationView', () => ({ SignatureSimulationView: () => null }));
vi.mock('@/components/ScamDetectionView', () => ({ ScamDetectionView: () => null }));
vi.mock('@/components/RedFlagIdentificationView', () => ({ RedFlagIdentificationView: () => null }));
vi.mock('@/components/TransactionInspectionView', () => ({ TransactionInspectionView: () => null }));
vi.mock('@/components/PermissionChallengeView', () => ({ PermissionChallengeView: () => null }));
vi.mock('@/components/TrainingModeHeader', () => ({ TrainingModeHeader: () => null }));
vi.mock('@/components/SectionCard', () => ({ SectionCard: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/PageHeading', () => ({ PageHeading: () => null }));
vi.mock('@/components/ProgressBar', () => ({ ProgressBar: () => null }));
vi.mock('@/components/AppIcon', () => ({ AppIcon: () => null }));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: () => ({
    progress: {
      level: 3,
      xpIntoCurrentLevel: 100,
      xpRequiredForNextLevel: 1000,
      xpToNextLevel: 900,
      totalXp: 1200,
      sessionsCompleted: 1,
      correctDecisions: 1,
      wrongDecisions: 0,
      winRate: 100,
      currentStreak: 1,
      bestStreak: 1,
      daily: {
        dayKey: '2026-09-11',
        dailyGoal: 3,
        todayCompletedDecisions: 0,
        dailyGoalCompleted: false,
        dailyCompletionBonusAwarded: false,
        dailyTrainingStreak: 1,
        bestDailyTrainingStreak: 1,
      },
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
      surpriseChallenges: { completed: {} },
      badges: { earned: {} },
    },
    resetProgress: vi.fn(),
    debugSimulatePreviousDay: vi.fn(),
  }),
}));

vi.mock('@/hooks/useTrainingScenario', () => ({
  useTrainingScenario: () => ({
    currentExercise: {
      id: 'exercise-1',
      type: 'decision',
      difficulty: 'easy',
      skill: 'riskManagement',
      scenario: 'stub',
      options: [],
      correctAnswer: 'hold',
      explanation: '',
      title: 'stub',
      xpReward: 10,
    },
    selectedAnswer: null,
    result: null,
    submitAnswer: vi.fn(),
    nextExercise: vi.fn(),
    debugSelectExercise: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      difficulty: 'Intermediate',
      notificationsEnabled: true,
      soundEffectsEnabled: true,
      hapticFeedbackEnabled: true,
    },
    setDifficulty: vi.fn(),
    setPreference: vi.fn(),
    resetSettings: vi.fn(),
  }),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    status: 'disconnected',
    wallet: null,
    error: null,
    realMessageSigningEnabled: false,
    trainingSigningMessage: {
      nonce: '001122',
      displayMessage: 'TrainRekt Wallet Safety Training',
      messageBytes: new Uint8Array([1]),
    },
    signingStatus: 'idle',
    signingError: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTrainingMessage: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSurpriseChallenge', () => ({
  useSurpriseChallenge: () => ({ startPreview: vi.fn() }),
}));

vi.mock('@/data/exerciseCatalog', () => ({ exerciseCatalog: [] }));
vi.mock('@/data/permissionChallengeCatalog', () => ({ permissionChallengeCatalog: [] }));
vi.mock('@/data/redFlagIdentificationCatalog', () => ({ redFlagIdentificationCatalog: [] }));
vi.mock('@/data/scamDetectionCatalog', () => ({ scamDetectionCatalog: [] }));
vi.mock('@/data/transactionInspectionCatalog', () => ({ transactionInspectionCatalog: [] }));
vi.mock('@/data/surpriseChallengeCatalog', () => ({ surpriseChallengeCatalog: [{ id: 'surprise-airdrop-001' }] }));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  ScrollView: 'ScrollView',
  LayoutAnimation: { configureNext: vi.fn() },
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Switch: 'Switch',
  Text: 'Text',
  View: 'View',
}));

describe('Tab screens use shared Screen wrapper', () => {
  it('renders Home, Train, Progress, and Settings through Screen composition', () => {
    let home!: ReturnType<typeof create>;
    let train!: ReturnType<typeof create>;
    let progress!: ReturnType<typeof create>;
    let settings!: ReturnType<typeof create>;

    act(() => {
      home = create(<HomeScreen />);
      train = create(<TrainScreen />);
      progress = create(<ProgressScreen />);
      settings = create(<SettingsScreen />);
    });

    expect(readText(home)).toContain('SCREEN_WRAPPER');
    expect(readText(train)).toContain('SCREEN_WRAPPER');
    expect(readText(progress)).toContain('SCREEN_WRAPPER');
    expect(readText(settings)).toContain('SCREEN_WRAPPER');
  });
});

function TextStub({ value }: { value: string }) {
  return React.createElement('Text', null, value);
}

function readText(renderer: ReturnType<typeof create>): string {
  return renderer.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => flattenChildren(node.props.children))
    .join(' ');
}

function flattenChildren(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenChildren).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return flattenChildren(value.children);
  return '';
}
