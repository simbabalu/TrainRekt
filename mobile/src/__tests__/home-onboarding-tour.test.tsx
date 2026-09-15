import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomeScreen from '@/app/(tabs)/index';

const pushMock = vi.hoisted(() => vi.fn());
const setHomeTourSeenVersionMock = vi.hoisted(() => vi.fn());
const tokenActionMock = vi.hoisted(() => vi.fn());
const settingsState = vi.hoisted(() => ({ homeTourSeenVersion: 0 }));

vi.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/components/home/homeOnboardingTourLogo', () => ({
  homeOnboardingTourLogo: { testUri: 'trainrekt-adaptive-foreground.png' },
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: { homeTourSeenVersion: settingsState.homeTourSeenVersion },
    setHomeTourSeenVersion: setHomeTourSeenVersionMock,
  }),
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

vi.mock('@/components/Screen', () => {
  const screenToMock = React.forwardRef(({ children }: { children: React.ReactNode }, ref) => {
    if (typeof ref === 'function') {
      ref({ scrollTo: () => undefined } as never);
    } else if (ref && 'current' in ref) {
      (ref as React.MutableRefObject<{ scrollTo: (options: unknown) => void } | null>).current = {
        scrollTo: () => undefined,
      };
    }
    return React.createElement('View', null, children);
  });
  screenToMock.displayName = 'ScreenMock';

  return { Screen: screenToMock };
});

vi.mock('@/components/LevelProgressCard', () => ({
  LevelProgressCard: () => React.createElement('Text', null, 'LEVEL_PROGRESS_CARD'),
}));

vi.mock('@/components/DailyGoalCard', () => ({
  DailyGoalCard: () => React.createElement('Text', null, 'DAILY GOAL'),
}));

vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => React.createElement('Pressable', { onPress }, React.createElement('Text', null, children)),
}));

vi.mock('@/components/TokenSafetyCheckCard', () => ({
  TokenSafetyCheckCard: () => React.createElement('Pressable', { accessibilityLabel: 'Underlying analyze token action', onPress: tokenActionMock }, React.createElement('Text', null, 'ANALYZE TOKEN')),
}));

vi.mock('@/components/wallet/HomeWalletSafetyCard', () => ({
  HomeWalletSafetyCard: () => React.createElement('Text', null, 'HOME WALLET SAFETY CARD'),
}));

vi.mock('react-native', () => ({
  Image: 'Image',
  Modal: ({ children, visible }: { children: React.ReactNode; visible?: boolean }) => visible ? React.createElement('View', null, children) : null,
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
  Text: 'Text',
  View: 'View',
  useWindowDimensions: () => ({ width: 420, height: 900 }),
}));

function readText(renderer: ReturnType<typeof create>): string {
  return renderer.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => flattenChildren(node.props.children))
    .join(' ');
}

function flattenChildren(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenChildren).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return flattenChildren((value as { children: unknown }).children);
  return '';
}

function goToFinalStep(renderer: ReturnType<typeof create>) {
  for (let index = 0; index < 3; index += 1) {
    const nextButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Next onboarding step');
    act(() => {
      nextButton.props.onPress();
    });
  }
}

beforeEach(() => {
  pushMock.mockReset();
  setHomeTourSeenVersionMock.mockReset();
  tokenActionMock.mockReset();
  settingsState.homeTourSeenVersion = 0;
});

describe('Home onboarding tour', () => {
  it('shows onboarding for unseen users and supports safe step progression without measured targets', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    expect(readText(renderer)).toContain('Welcome to TrainRekt');
    expect(readText(renderer)).toContain('1 / 4');
    expect(readText(renderer)).toContain('SKIP');
    expect(readText(renderer)).not.toContain('BACK');

    const nextButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Next onboarding step');
    act(() => {
      nextButton.props.onPress();
    });

    expect(readText(renderer)).toContain('Token Safety Check');
    expect(readText(renderer)).toContain('2 / 4');
    expect(readText(renderer)).toContain('BACK');
    expect(readText(renderer)).toContain('NEXT');

    const backButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Go to previous onboarding step');
    act(() => {
      backButton.props.onPress();
    });

    expect(readText(renderer)).toContain('Welcome to TrainRekt');
    expect(setHomeTourSeenVersionMock).not.toHaveBeenCalled();
  });

  it('navigates back from steps three and four without persisting completion', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    act(() => {
      renderer.root.find((node) => node.props.accessibilityLabel === 'Next onboarding step').props.onPress();
      renderer.root.find((node) => node.props.accessibilityLabel === 'Next onboarding step').props.onPress();
    });

    expect(readText(renderer)).toContain('Wallet Safety');
    act(() => {
      renderer.root.find((node) => node.props.accessibilityLabel === 'Go to previous onboarding step').props.onPress();
    });
    expect(readText(renderer)).toContain('Token Safety Check');

    act(() => {
      renderer.root.find((node) => node.props.accessibilityLabel === 'Next onboarding step').props.onPress();
      renderer.root.find((node) => node.props.accessibilityLabel === 'Next onboarding step').props.onPress();
    });

    expect(readText(renderer)).toContain('Train. Improve. Stay safer.');
    expect(readText(renderer)).toContain('BACK');
    expect(readText(renderer)).toContain('FINISH');
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Start training and finish app tour')).toHaveLength(0);
    act(() => {
      renderer.root.find((node) => node.props.accessibilityLabel === 'Go to previous onboarding step').props.onPress();
    });

    expect(readText(renderer)).toContain('Wallet Safety');
    expect(setHomeTourSeenVersionMock).not.toHaveBeenCalled();
  });

  it('does not auto-show onboarding when already seen', () => {
    settingsState.homeTourSeenVersion = 1;

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    expect(readText(renderer)).not.toContain('Welcome to TrainRekt');
    expect(readText(renderer)).not.toContain('1 / 4');
  });

  it('skip closes and persists tour as seen', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    const skipButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Skip app tour');
    act(() => {
      skipButton.props.onPress();
    });

    settingsState.homeTourSeenVersion = 1;
    act(() => {
      renderer.update(<HomeScreen />);
    });

    expect(setHomeTourSeenVersionMock).toHaveBeenCalledWith(1);
    expect(readText(renderer)).not.toContain('Welcome to TrainRekt');
  });

  it('finish closes and persists the tour without navigating', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    goToFinalStep(renderer);

    const finishButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Finish app tour');
    act(() => {
      finishButton.props.onPress();
    });

    settingsState.homeTourSeenVersion = 1;
    act(() => {
      renderer.update(<HomeScreen />);
    });

    expect(setHomeTourSeenVersionMock).toHaveBeenCalledWith(1);
  expect(pushMock).not.toHaveBeenCalled();
    expect(readText(renderer)).not.toContain('Train. Improve. Stay safer.');
  });

  it('blocks underlying Home action presses while overlay is active', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<HomeScreen />);
    });

    const nextButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Next onboarding step');
    act(() => {
      nextButton.props.onPress();
    });

    const blocker = renderer.root.find((node) => node.props.accessibilityLabel === 'Tour overlay blocker');
    act(() => {
      blocker.props.onPress();
    });

    expect(tokenActionMock).not.toHaveBeenCalled();
  });
});
