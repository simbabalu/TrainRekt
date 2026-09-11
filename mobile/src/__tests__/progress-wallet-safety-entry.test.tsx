import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import ProgressScreen from '@/app/(tabs)/explore';

const pushMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/PageHeading', () => ({ PageHeading: () => null }));
vi.mock('@/components/SectionCard', () => ({ SectionCard: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/LevelProgressCard', () => ({ LevelProgressCard: () => null }));
vi.mock('@/components/ProgressBar', () => ({ ProgressBar: () => null }));
vi.mock('@/components/AppIcon', () => ({ AppIcon: () => null }));
vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => React.createElement('Pressable', { onPress, disabled }, React.createElement('Text', null, children)),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

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
  }),
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

describe('Progress wallet safety entry', () => {
  it('navigates to wallet safety route when CTA is pressed', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ProgressScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('WALLET SAFETY');
    expect(text).toContain('READ ONLY');
    expect(text).toContain('No signature required');
    expect(text).toContain('OPEN WALLET SAFETY');

    const buttonNode = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];

    expect(buttonNode).toBeDefined();
    expect(buttonNode.props.disabled).toBeFalsy();

    act(() => {
      buttonNode.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/wallet-safety');
  });
});
