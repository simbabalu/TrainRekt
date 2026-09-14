import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import RootLayout from '@/app/_layout';
import TabsLayout from '@/app/(tabs)/_layout';

const walletProviderMock = vi.hoisted(() => vi.fn(({ children }: { children: React.ReactNode }) => React.createElement('WalletProvider', null, children)));
const progressProviderMock = vi.hoisted(() => vi.fn(({ children }: { children: React.ReactNode }) => React.createElement('TrainingProgressProvider', null, children)));
const surpriseProviderMock = vi.hoisted(() => vi.fn(({ children }: { children: React.ReactNode }) => React.createElement('SurpriseChallengeProvider', null, children)));
const settingsProviderMock = vi.hoisted(() => vi.fn(({ children }: { children: React.ReactNode }) => React.createElement('SettingsProvider', null, children)));

vi.mock('expo-router', () => {
  function MockStack({ children }: { children: React.ReactNode }) {
    return React.createElement('Stack', null, children);
  }

  function MockStackScreen({ name }: { name: string }) {
    return React.createElement('StackScreen', { name });
  }

  function MockThemeProvider({ children }: { children: React.ReactNode }) {
    return React.createElement('ThemeProvider', null, children);
  }

  const Stack = MockStack as typeof MockStack & {
    Screen: typeof MockStackScreen;
  };
  Stack.Screen = MockStackScreen;

  return {
    DarkTheme: {},
    ThemeProvider: MockThemeProvider,
    Stack,
  };
});

vi.mock('@/components/app-tabs', () => ({
  default: function MockAppTabs() {
    return React.createElement('Text', null, 'APP_TABS');
  },
}));

vi.mock('@/components/share/ShareIntentCoordinator', () => ({
  ShareIntentCoordinator: () => null,
}));

vi.mock('@/context/WalletContext', () => ({
  WalletProvider: walletProviderMock,
}));

vi.mock('@/context/TrainingProgressContext', () => ({
  TrainingProgressProvider: progressProviderMock,
}));

vi.mock('@/context/SurpriseChallengeContext', () => ({
  SurpriseChallengeProvider: surpriseProviderMock,
}));

vi.mock('@/context/SettingsContext', () => ({
  SettingsProvider: settingsProviderMock,
}));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: () => ({ isHydrated: true }),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ isHydrated: true }),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

function flattenText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return flattenText(value.children);
  return '';
}

describe('Router topology', () => {
  it('mounts the root stack with the shared tabs shell', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<RootLayout />);
    });

    const stackScreens = renderer.root.findAll((node) => String(node.type) === 'StackScreen');
    expect(stackScreens).toHaveLength(1);
    expect(stackScreens[0].props.name).toBe('(tabs)');
  });

  it('keeps each global provider single-mounted in root layout', () => {
    act(() => {
      create(<RootLayout />);
    });

    expect(walletProviderMock).toHaveBeenCalledTimes(1);
    expect(progressProviderMock).toHaveBeenCalledTimes(1);
    expect(surpriseProviderMock).toHaveBeenCalledTimes(1);
    expect(settingsProviderMock).toHaveBeenCalledTimes(1);
  });

  it('renders tabs layout through AppTabs only', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TabsLayout />);
    });

    expect(flattenText(renderer.toJSON())).toContain('APP_TABS');
  });
});
