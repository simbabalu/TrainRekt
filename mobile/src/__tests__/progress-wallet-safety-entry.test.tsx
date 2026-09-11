import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import ProgressScreen from '@/app/(tabs)/explore';

const useTrainingProgressMock = vi.hoisted(() => vi.fn());
const levelPropsSpy = vi.hoisted(() => vi.fn());
const walletHookSpy = vi.hoisted(() => vi.fn());

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/PageHeading', () => ({ PageHeading: () => null }));
vi.mock('@/components/SectionCard', () => ({ SectionCard: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/LevelProgressCard', () => ({
  LevelProgressCard: (props: unknown) => {
    levelPropsSpy(props);
    return React.createElement('Text', null, 'LEVEL CARD');
  },
}));
vi.mock('@/components/ProgressBar', () => ({
  ProgressBar: ({ label, percentage }: { label: string; percentage: number }) => React.createElement('Text', null, `${label} ${percentage}%`),
}));
vi.mock('@/components/AppIcon', () => ({ AppIcon: () => null }));
vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => React.createElement('Pressable', { onPress, disabled }, React.createElement('Text', null, children)),
}));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => {
    walletHookSpy();
    return { status: 'disconnected' };
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: () => useTrainingProgressMock(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

describe('Progress screen focus', () => {
  function makeProgress() {
    return {
      level: 1,
      xpIntoCurrentLevel: 420,
      xpRequiredForNextLevel: 1000,
      xpToNextLevel: 580,
      progressPercentage: 42,
      totalXp: 420,
      sessionsCompleted: 3,
      correctDecisions: 2,
      wrongDecisions: 1,
      winRate: 67,
      currentStreak: 1,
      bestStreak: 1,
      skillScores: {
        riskManagement: 52,
        profitTaking: 52,
        fomoResistance: 50,
        positionSizing: 50,
        scamAwareness: 50,
        leverageRisk: 50,
        panicSelling: 50,
        marketInterpretation: 50,
        walletSafety: 49,
      },
      recentTrainingHistory: [
        {
          id: 'h3',
          scenarioId: 's3',
          scenarioTitle: 'Poor Risk/Reward',
          correct: true,
          skill: 'riskManagement',
          timestamp: '2026-09-11T12:02:00.000Z',
          xpEarned: 100,
          exerciseType: 'decision',
        },
        {
          id: 'h2',
          scenarioId: 's2',
          scenarioTitle: 'DEX Swap Route Execution',
          correct: false,
          skill: 'walletSafety',
          timestamp: '2026-09-11T12:01:00.000Z',
          xpEarned: 30,
          exerciseType: 'transaction-inspection',
        },
        {
          id: 'h1',
          scenarioId: 's1',
          scenarioTitle: 'SOL Second Entry',
          correct: true,
          skill: 'profitTaking',
          timestamp: '2026-09-11T12:00:00.000Z',
          xpEarned: 140,
          exerciseType: 'decision',
        },
        {
          id: 'h0',
          scenarioId: 's0',
          scenarioTitle: 'Old Entry',
          correct: true,
          skill: 'profitTaking',
          timestamp: '2026-09-11T11:59:00.000Z',
          xpEarned: 80,
          exerciseType: 'decision',
        },
      ],
      walletLessonRewards: { claimedExerciseIds: [] },
      walletLessonProgress: {},
      daily: {
        todayDateKey: '2026-09-11',
        dailyGoal: 3,
        todayCompletedDecisions: 3,
        dailyGoalCompleted: true,
        lastDailyCompletionDate: '2026-09-11',
        dailyTrainingStreak: 1,
        bestDailyTrainingStreak: 1,
      },
      surpriseChallenges: { completed: {} },
      badges: { earned: {} },
    };
  }

  it('uses authoritative level summary props and renders compact overview labels', () => {
    levelPropsSpy.mockReset();
    walletHookSpy.mockReset();
    const recordSurpriseChallengeCompletion = vi.fn();
    useTrainingProgressMock.mockReturnValue({ progress: makeProgress(), recordSurpriseChallengeCompletion });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ProgressScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(levelPropsSpy).toHaveBeenCalledWith(expect.objectContaining({
      summary: expect.objectContaining({
        level: 1,
        xpIntoCurrentLevel: 420,
        xpRequiredForNextLevel: 1000,
        xpToNextLevel: 580,
        progressPercentage: 42,
      }),
      totalXp: 420,
    }));
    expect(text).toContain('TRAINING OVERVIEW');
    expect(text).toContain('Decisions');
    expect(text).toContain('Accuracy');
    expect(text).toContain('Current streak');
    expect(text).toContain('Best streak');
    expect(text).toContain('3');
    expect(text).toContain('67%');
    expect(text).toContain('DAILY TRAINING');
    expect(text).toContain('3/3');
    expect(text).toContain('Day streak');
    expect(text).toContain('Best');
    expect(text).toContain('ACHIEVEMENTS');
    expect(text).toContain('No achievements earned yet.');
    expect(text).toContain('RECENT TRAINING');
    expect(text).toContain('Poor Risk/Reward');
    expect(text).toContain('DEX Swap Route Execution');
    expect(text).toContain('SOL Second Entry');
    expect(text).not.toContain('Old Entry');
    expect(text).not.toContain('WALLET SAFETY');
    expect(text).not.toContain('READ ONLY');
    expect(text).not.toContain('OPEN WALLET SAFETY');
    expect(walletHookSpy).not.toHaveBeenCalled();
    expect(recordSurpriseChallengeCompletion).not.toHaveBeenCalled();
  });

  it('supports 0/3, partial, and 3/3 daily states', () => {
    const base = makeProgress();
    useTrainingProgressMock.mockReturnValue({
      progress: {
        ...base,
        daily: { ...base.daily, todayCompletedDecisions: 0, dailyGoalCompleted: false, dailyTrainingStreak: 0, bestDailyTrainingStreak: 1 },
      },
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ProgressScreen />);
    });
    expect(renderedText(renderer.toJSON())).toContain('0/3');

    useTrainingProgressMock.mockReturnValue({
      progress: {
        ...base,
        daily: { ...base.daily, todayCompletedDecisions: 2, dailyGoalCompleted: false, dailyTrainingStreak: 4, bestDailyTrainingStreak: 6 },
      },
    });
    act(() => {
      renderer.update(<ProgressScreen />);
    });
    expect(renderedText(renderer.toJSON())).toContain('2/3');
    expect(renderedText(renderer.toJSON())).toContain('4');
    expect(renderedText(renderer.toJSON())).toContain('6');

    useTrainingProgressMock.mockReturnValue({ progress: base });
    act(() => {
      renderer.update(<ProgressScreen />);
    });
    expect(renderedText(renderer.toJSON())).toContain('3/3');
  });

  it('shows compact skill summary and expands/collapses all skills with untrained messaging', () => {
    const progress = {
      ...makeProgress(),
      skillScores: {
        riskManagement: 52,
        profitTaking: 52,
        fomoResistance: 50,
        positionSizing: 50,
        scamAwareness: 50,
        leverageRisk: 50,
        panicSelling: 50,
        marketInterpretation: 50,
        walletSafety: 49,
      },
      recentTrainingHistory: [
        {
          id: 's-1',
          scenarioId: 'x',
          scenarioTitle: 'Entry',
          correct: true,
          skill: 'riskManagement',
          timestamp: '2026-09-11T12:00:00.000Z',
          xpEarned: 100,
          exerciseType: 'decision',
        },
        {
          id: 's-2',
          scenarioId: 'y',
          scenarioTitle: 'Entry 2',
          correct: false,
          skill: 'walletSafety',
          timestamp: '2026-09-11T12:01:00.000Z',
          xpEarned: 30,
          exerciseType: 'transaction-inspection',
        },
      ],
    };
    useTrainingProgressMock.mockReturnValue({ progress });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ProgressScreen />);
    });

    let text = renderedText(renderer.toJSON());
    expect(text).toContain('YOUR SKILLS');
    expect(text).toContain('Strongest');
    expect(text).toContain('Needs Practice');
    expect(text).toContain('Risk Management');
    expect(text).toContain('Profit Taking');
    expect(text).toContain('Wallet Safety');
    expect(/49\s*%/.test(text)).toBe(true);
    expect(text).toContain('VIEW ALL SKILLS');

    const expandButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')
      .find((node) => renderedText(node).includes('VIEW ALL SKILLS'));
    expect(expandButton).toBeDefined();

    act(() => {
      expandButton?.props.onPress();
    });

    text = renderedText(renderer.toJSON());
    expect(text).toContain('SHOW LESS');
    expect(text).toContain('FOMO Resistance');
    expect(text).toContain('Not trained yet');

    const collapseButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')
      .find((node) => renderedText(node).includes('SHOW LESS'));
    expect(collapseButton).toBeDefined();

    act(() => {
      collapseButton?.props.onPress();
    });

    text = renderedText(renderer.toJSON());
    expect(text).toContain('VIEW ALL SKILLS');
  });

  it('renders earned achievements from existing badge state only', () => {
    const progress = makeProgress();
    progress.badges.earned = {
      'airdrop-survivor': {
        earnedAt: '2026-09-11T12:00:00.000Z',
        sourceChallengeId: 'surprise-airdrop-001',
        sourceChallengeVersion: 1,
      },
    };
    useTrainingProgressMock.mockReturnValue({ progress, recordSurpriseChallengeCompletion: vi.fn() });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ProgressScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('Airdrop Survivor');
    expect(text).toContain('Completed the fake airdrop surprise challenge with a safe final rejection.');
  });

  it('shows an empty state when there is no recent training', () => {
    const progress = makeProgress();
    progress.recentTrainingHistory = [];
    useTrainingProgressMock.mockReturnValue({ progress });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ProgressScreen />);
    });

    expect(renderedText(renderer.toJSON())).toContain('No recent training yet.');
  });
});
