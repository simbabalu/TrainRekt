import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import ProgressScreen from '@/app/(tabs)/explore';

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
  useRouter: () => ({ push: vi.fn() }),
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

describe('Progress screen focus', () => {
  it('does not render wallet-safety UI', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ProgressScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).not.toContain('WALLET SAFETY');
    expect(text).not.toContain('READ ONLY');
    expect(text).not.toContain('OPEN WALLET SAFETY');
    expect(text).toContain('TRAINING STATS');
    expect(text).toContain('DAILY TRAINING');
    expect(text).toContain('SKILLS');
  });
});
