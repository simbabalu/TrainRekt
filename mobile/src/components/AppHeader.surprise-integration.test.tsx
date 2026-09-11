import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Screen } from './Screen';
import { SurpriseChallengeProvider } from '@/context/SurpriseChallengeContext';
import { WalletProvider } from '@/context/WalletContext';
import type { MobileWalletService } from '@/services/wallet/mobileWalletService';

Object.defineProperty(globalThis, '__DEV__', {
  value: false,
  configurable: true,
});

const useTrainingProgressMock = vi.hoisted(() => vi.fn());
const modalSessionRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: useTrainingProgressMock,
}));

vi.mock('@/components/SurpriseChallengeModal', () => ({
  SurpriseChallengeModal: ({ session }: { session: unknown }) => {
    modalSessionRef.current = session;
    return null;
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

vi.mock('react-native', () => ({
  Modal: ({ children, visible }: { children: React.ReactNode; visible?: boolean }) => visible ? React.createElement('View', null, children) : null,
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

function createMockService(): MobileWalletService {
  return {
    connectWallet: vi.fn(),
    disconnectWallet: vi.fn(),
    signMessage: vi.fn(),
  };
}

describe('AppHeader wallet connect surprise integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    modalSessionRef.current = null;
    useTrainingProgressMock.mockReturnValue({
      isHydrated: true,
      progress: { surpriseChallenges: { completed: {} } },
      recordSurpriseChallengeCompletion: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    modalSessionRef.current = null;
  });

  it('connecting from global header flows through WalletContext and remains observable by SurpriseChallengeProvider', async () => {
    const service = createMockService();
    let resolveConnect: ((value: { ok: true; wallet: { address: string; label?: string } }) => void) | null = null;

    vi.mocked(service.connectWallet).mockImplementation(
      () => new Promise((resolve) => {
        resolveConnect = resolve as (value: { ok: true; wallet: { address: string; label?: string } }) => void;
      }),
    );
    vi.mocked(service.disconnectWallet).mockResolvedValue({ ok: true });

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <WalletProvider service={service}>
          <SurpriseChallengeProvider>
            <Screen>
              <></>
            </Screen>
          </SurpriseChallengeProvider>
        </WalletProvider>,
      );
    });

    const connectButton = renderer.root.find((node) => node.props.accessibilityLabel === 'Connect wallet');

    act(() => {
      connectButton.props.onPress();
    });

    let text = readAllText(renderer);
    expect(text).toContain('CONNECTING...');
    expect(service.connectWallet).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveConnect?.({
        ok: true,
        wallet: {
          label: 'pascalschaer.skr',
          address: '51SYwT7hXpnYccF6Uabvwp7mQkY6MoBVVqf3v83oJZ',
        },
      });
      await Promise.resolve();
    });

    text = readAllText(renderer);
    expect(text).toMatch(/pascalschaer\.skr\s+v/);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const active = modalSessionRef.current as { challenge?: { id?: string } } | null;
    expect(active?.challenge?.id).toBe('surprise-airdrop-001');
  });
});

function readAllText(renderer: ReturnType<typeof create>): string {
  return renderer.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => stringifyChildren(node.props.children))
    .join(' ');
}

function stringifyChildren(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(stringifyChildren).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return stringifyChildren(value.children);
  return '';
}
