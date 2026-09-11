import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import { SurpriseChallengeCompletionInput } from '@/types/surpriseChallenge';
import { WalletConnectionStatus } from '@/types/wallet';
import { useSurpriseChallengeEngine } from './useSurpriseChallengeEngine';

Object.defineProperty(globalThis, '__DEV__', {
  value: true,
  configurable: true,
});

interface HarnessProps {
  walletStatus: WalletConnectionStatus;
  isHydrated?: boolean;
  completed: Record<string, {
    challengeVersion: number;
    completedAt: string;
    firstDecision: 'sign' | 'inspect' | 'reject';
    finalDecision: 'sign' | 'reject';
    xpAwarded: number;
    badgeEarned: boolean;
  }>;
  onComplete: (completion: SurpriseChallengeCompletionInput) => void;
}

describe('useSurpriseChallengeEngine', () => {
  let latest: ReturnType<typeof useSurpriseChallengeEngine>;

  function Harness({ walletStatus, isHydrated = true, completed, onComplete }: HarnessProps) {
    latest = useSurpriseChallengeEngine({
      challenges: surpriseChallengeCatalog,
      walletStatus,
      progress: { completed },
      isHydrated,
      onComplete,
      randomFn: () => 0,
    });
    return null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules on disconnected-to-connected transition and avoids duplicate scheduling on rerender', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });

    expect(latest.activeSession).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(latest.activeSession).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');
  });

  it('triggers once for disconnected->connecting->connected sequence', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="connecting" completed={{}} onComplete={onComplete} />);
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');
  });

  it('triggers once for connecting->connected when engine observed pre-connected state', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="connecting" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');
  });

  it('does not trigger when already connected on first render', () => {
    const onComplete = vi.fn();

    act(() => {
      create(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(latest.activeSession).toBeNull();
  });

  it('queues disconnected-to-connected trigger before hydration and schedules once after hydration', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" isHydrated={false} completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="connected" isHydrated={false} completed={{}} onComplete={onComplete} />);
      vi.advanceTimersByTime(4000);
    });

    expect(latest.activeSession).toBeNull();

    act(() => {
      renderer.update(<Harness walletStatus="connected" isHydrated completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      vi.advanceTimersByTime(1499);
    });

    expect(latest.activeSession).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');
  });

  it('queues disconnected->connecting->connected before hydration and schedules once after hydration', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" isHydrated={false} completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="connecting" isHydrated={false} completed={{}} onComplete={onComplete} />);
      renderer.update(<Harness walletStatus="connected" isHydrated={false} completed={{}} onComplete={onComplete} />);
      vi.advanceTimersByTime(4000);
    });

    expect(latest.activeSession).toBeNull();

    act(() => {
      renderer.update(<Harness walletStatus="connected" isHydrated completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');
  });

  it('does not trigger from unrelated rerenders without disconnected-to-connected transition', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
      renderer.update(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
      vi.advanceTimersByTime(4000);
    });

    expect(latest.activeSession).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('scheduled timer survives unrelated rerenders while connected', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
      vi.advanceTimersByTime(1499);
    });

    expect(latest.activeSession).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');
  });

  it('disconnect then reconnect before completion does not create duplicate scheduled challenges', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
      vi.advanceTimersByTime(1499);
    });

    expect(latest.activeSession).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');
  });

  it('supports inspect then reject with acceptable XP and write-once completion', async () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(latest.activeSession?.stage).toBe('prompt');

    act(() => {
      latest.chooseDecision('inspect');
    });
    expect(latest.activeSession?.stage).toBe('inspect');

    await act(async () => {
      latest.chooseDecision('reject');
      await Promise.resolve();
    });

    expect(latest.activeSession?.stage).toBe('reveal');
    expect(latest.activeSession?.firstDecision).toBe('inspect');
    expect(latest.activeSession?.finalDecision).toBe('reject');
    expect(latest.activeSession?.xpAwarded).toBe(250);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].firstDecision).toBe('inspect');
    expect(onComplete.mock.calls[0][0].finalDecision).toBe('reject');
    expect(onComplete.mock.calls[0][0].xpAwarded).toBe(250);
  });

  it('countdown decrements and reaching zero does not auto-complete or auto-sign', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(latest.activeSession?.countdownSecondsRemaining).toBe(84);

    act(() => {
      vi.advanceTimersByTime(85000);
    });

    expect(latest.activeSession?.countdownSecondsRemaining).toBe(0);
    expect(latest.activeSession?.stage).toBe('prompt');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not re-trigger completed challenge after reconnect and cancels timer on unmount', () => {
    const onComplete = vi.fn();
    const completed = {
      'surprise-airdrop-001': {
        challengeVersion: 1,
        completedAt: '2026-09-11T08:00:00.000Z',
        firstDecision: 'reject' as const,
        finalDecision: 'reject' as const,
        xpAwarded: 300,
        badgeEarned: true,
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={completed} onComplete={onComplete} />);
    });

    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={completed} onComplete={onComplete} />);
      vi.advanceTimersByTime(3000);
    });

    expect(latest.activeSession).toBeNull();

    act(() => {
      renderer.unmount();
      vi.advanceTimersByTime(5000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('cancels scheduled timer on unmount before firing', () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
      vi.advanceTimersByTime(1000);
    });

    expect(latest.activeSession).toBeNull();

    act(() => {
      renderer.unmount();
      vi.advanceTimersByTime(5000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('preview mode opens challenge but never persists completion or XP', async () => {
    const onComplete = vi.fn();

    act(() => {
      create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });

    act(() => {
      const started = latest.startPreview('surprise-airdrop-001');
      expect(started).toBe(true);
    });

    expect(latest.activeSession?.isPreview).toBe(true);

    await act(async () => {
      latest.chooseDecision('reject');
      await Promise.resolve();
    });

    expect(latest.activeSession?.stage).toBe('reveal');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('allows completion commit again after canonical progress is reset (prepare-demo style)', async () => {
    const onComplete = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(latest.activeSession).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');

    await act(async () => {
      latest.chooseDecision('reject');
      await Promise.resolve();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);

    act(() => {
      latest.dismissReveal();
      renderer.update(<Harness walletStatus="disconnected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      renderer.update(<Harness walletStatus="connected" completed={{}} onComplete={onComplete} />);
    });
    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(latest.activeSession).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(latest.activeSession?.challenge.id).toBe('surprise-airdrop-001');

    await act(async () => {
      latest.chooseDecision('reject');
      await Promise.resolve();
    });

    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});
