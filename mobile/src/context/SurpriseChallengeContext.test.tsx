import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SurpriseChallengeProvider } from './SurpriseChallengeContext';
import { WalletConnectionStatus } from '@/types/wallet';

Object.defineProperty(globalThis, '__DEV__', {
  value: true,
  configurable: true,
});

const useWalletMock = vi.hoisted(() => vi.fn());
const useTrainingProgressMock = vi.hoisted(() => vi.fn());
const modalSessionRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

vi.mock('@/hooks/useTrainingProgress', () => ({
  useTrainingProgress: useTrainingProgressMock,
}));

vi.mock('@/components/SurpriseChallengeModal', () => ({
  SurpriseChallengeModal: ({ session }: { session: unknown }) => {
    modalSessionRef.current = session;
    return null;
  },
}));

describe('SurpriseChallengeProvider modal host', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    modalSessionRef.current = null;
  });

  it('passes active challenge to modal host after wallet transition', () => {
    const state: { walletStatus: WalletConnectionStatus } = { walletStatus: 'disconnected' };

    useWalletMock.mockImplementation(() => ({ status: state.walletStatus }));
    useTrainingProgressMock.mockReturnValue({
      isHydrated: true,
      progress: { surpriseChallenges: { completed: {} } },
      recordSurpriseChallengeCompletion: vi.fn(),
    });

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SurpriseChallengeProvider>
          <></>
        </SurpriseChallengeProvider>,
      );
    });

    expect(modalSessionRef.current).toBeNull();

    state.walletStatus = 'connected';
    act(() => {
      renderer.update(
        <SurpriseChallengeProvider>
          <></>
        </SurpriseChallengeProvider>,
      );
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const active = modalSessionRef.current as { challenge?: { id?: string } } | null;
    expect(active?.challenge?.id).toBe('surprise-airdrop-001');
  });
});
