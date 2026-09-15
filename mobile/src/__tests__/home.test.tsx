import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HomeScreen from '@/app/(tabs)/index';

const useTrainingProgressMock = vi.hoisted(() => vi.fn());
const useSettingsMock = vi.hoisted(() => vi.fn());
const routeState = vi.hoisted(() => ({ pathname: '/' }));
const latestTourProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: useTrainingProgressMock,
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: useSettingsMock,
}));

vi.mock('expo-router', () => ({
  Link: 'Link',
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => routeState.pathname,
}));

vi.mock('@/components/home/HomeOnboardingTour', () => ({
  HomeOnboardingTour: (props: Record<string, unknown>) => {
    latestTourProps.current = props;
    return React.createElement('Text', null, props.visible ? 'HOME_TOUR_VISIBLE' : 'HOME_TOUR_HIDDEN');
  },
}));

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/LevelProgressCard', () => ({
  LevelProgressCard: ({ dailyStreak, showTotalXp }: { dailyStreak?: number; showTotalXp?: boolean }) => React.createElement('Text', null, `LEVEL_PROGRESS_CARD ${dailyStreak ?? ''} ${showTotalXp === false ? 'NO_TOTAL_XP' : ''}`),
}));

vi.mock('@/components/DailyGoalCard', () => ({
  DailyGoalCard: () => React.createElement('Text', null, 'DAILY GOAL'),
}));

vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children }: { children: React.ReactNode }) => React.createElement('Text', null, children),
}));

vi.mock('@/components/TokenSafetyCheckCard', () => ({
  TokenSafetyCheckCard: () => React.createElement('Text', null, 'TOKEN SAFETY CHECK CARD'),
}));

vi.mock('@/components/wallet/HomeWalletSafetyCard', () => ({
  HomeWalletSafetyCard: () => React.createElement('Text', null, 'HOME WALLET SAFETY CARD'),
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: React.forwardRef(function ViewMock(
    {
      children,
      onLayout,
      ...props
    }: {
      children?: React.ReactNode;
      onLayout?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
      [key: string]: unknown;
    },
    ref: React.ForwardedRef<{ measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void } | null>,
  ) {
    const layoutRef = React.useRef({ x: 40, y: 300, width: 200, height: 72 });

    if (typeof ref === 'function') {
      ref({
        measureInWindow: (callback) => {
          const { x, y, width, height } = layoutRef.current;
          callback(x, y, width, height);
        },
      });
    } else if (ref && 'current' in ref) {
      ref.current = {
        measureInWindow: (callback) => {
          const { x, y, width, height } = layoutRef.current;
          callback(x, y, width, height);
        },
      };
    }

    return React.createElement('View', {
      ...props,
      onLayout: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => {
        const { y, height } = event.nativeEvent.layout;
        layoutRef.current = { x: 40, y, width: 200, height };
        onLayout?.(event);
      },
    }, children);
  }),
}));

beforeEach(() => {
  routeState.pathname = '/';
  latestTourProps.current = null;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

function makeProgress(todayCompletedDecisions: number, dailyGoalCompleted: boolean) {
  return {
    level: 3,
    xpIntoCurrentLevel: 240,
    xpRequiredForNextLevel: 1000,
    xpToNextLevel: 760,
    totalXp: 2240,
    sessionsCompleted: 12,
    correctDecisions: 8,
    wrongDecisions: 4,
    winRate: 67,
    currentStreak: 2,
    bestStreak: 5,
    daily: {
      dayKey: '2026-09-11',
      dailyGoal: 3,
      todayCompletedDecisions,
      dailyGoalCompleted,
      dailyCompletionBonusAwarded: dailyGoalCompleted,
      dailyTrainingStreak: 4,
      bestDailyTrainingStreak: 6,
    },
    skillScores: {
      riskManagement: 60,
      profitTaking: 52,
      fomoResistance: 44,
      positionSizing: 51,
      scamAwareness: 48,
      leverageRisk: 55,
      panicSelling: 58,
      marketInterpretation: 63,
      walletSafety: 70,
    },
    recentTrainingHistory: [],
    surpriseChallenges: { completed: {} },
    badges: { earned: {} },
  };
}

describe('HomeScreen simplified layout', () => {
  it('removes Today\'s Training and Your Skills while keeping Daily Goal central', () => {
    useSettingsMock.mockReturnValue({
      settings: { homeTourSeenVersion: 1 },
      setHomeTourSeenVersion: vi.fn(),
    });
    useTrainingProgressMock.mockReturnValue({
      progress: makeProgress(0, false),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('LEVEL_PROGRESS_CARD');
    expect(text).toContain('DAILY GOAL');
    expect(text).toContain('4');
    expect(text).toContain('NO_TOTAL_XP');
    expect(text).not.toContain('DAILY STREAK');
    expect(text).not.toContain('2240 XP total');
    expect(text).toContain('START TRAINING');
    expect(text).toContain('TOKEN SAFETY CHECK CARD');
    expect(text).toContain('HOME WALLET SAFETY CARD');
    expect(text.indexOf('LEVEL_PROGRESS_CARD')).toBeLessThan(text.indexOf('TOKEN SAFETY CHECK CARD'));
    expect(text.indexOf('TOKEN SAFETY CHECK CARD')).toBeLessThan(text.indexOf('HOME WALLET SAFETY CARD'));
    expect(text.indexOf('HOME WALLET SAFETY CARD')).toBeLessThan(text.indexOf('DAILY GOAL'));
    expect(text).not.toContain("TODAY'S TRAINING");
    expect(text).not.toContain('YOUR SKILLS');
  });

  it('shows CONTINUE TRAINING before daily goal completion when progress already started', () => {
    useSettingsMock.mockReturnValue({
      settings: { homeTourSeenVersion: 1 },
      setHomeTourSeenVersion: vi.fn(),
    });
    useTrainingProgressMock.mockReturnValue({
      progress: makeProgress(1, false),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('CONTINUE TRAINING');

    const linkNode = renderer.root.findAll((node) => String(node.type) === 'Link')[0];
    expect(linkNode.props.href).toEqual({ pathname: '/train', params: { mode: 'daily' } });
  });

  it('shows EXTRA PRACTICE after daily completion and keeps train routing mode', () => {
    useSettingsMock.mockReturnValue({
      settings: { homeTourSeenVersion: 1 },
      setHomeTourSeenVersion: vi.fn(),
    });
    useTrainingProgressMock.mockReturnValue({
      progress: makeProgress(3, true),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('EXTRA PRACTICE');

    const linkNode = renderer.root.findAll((node) => String(node.type) === 'Link')[0];
    expect(linkNode.props.href).toEqual({ pathname: '/train', params: { mode: 'practice' } });
  });

  it('keeps tour hidden off-home route and measures token spotlight after Home becomes active', () => {
    useSettingsMock.mockReturnValue({
      settings: { homeTourSeenVersion: 0 },
      setHomeTourSeenVersion: vi.fn(),
    });
    useTrainingProgressMock.mockReturnValue({
      progress: makeProgress(0, false),
    });

    routeState.pathname = '/settings';
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    expect(latestTourProps.current?.visible).toBe(false);

    routeState.pathname = '/';
    act(() => {
      renderer.update(<HomeScreen />);
    });
    expect(latestTourProps.current?.visible).toBe(true);

    act(() => {
      (latestTourProps.current?.onNext as (() => void) | undefined)?.();
    });

    const targetLayouts = renderer.root.findAll((node) => typeof node.props.onLayout === 'function');
    expect(targetLayouts.length).toBeGreaterThan(0);

    act(() => {
      targetLayouts.forEach((node) => {
        node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 320, width: 320, height: 72 } } });
      });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(latestTourProps.current?.stepIndex).toBe(1);
    expect(latestTourProps.current?.spotlightRect).toMatchObject({ x: 40, y: 320, width: 200, height: 72 });
  });
});
