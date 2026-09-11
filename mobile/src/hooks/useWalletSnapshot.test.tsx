import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { WalletSnapshotService } from '@/services/solana/walletSnapshotService';
import type { WalletConnectionStatus } from '@/types/wallet';
import type { WalletSnapshot } from '@/types/walletSnapshot';
import { useWalletSnapshot } from './useWalletSnapshot';

const useWalletMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

type Controller = ReturnType<typeof useWalletSnapshot>;

interface WalletState {
  status: WalletConnectionStatus;
  wallet: { address: string; label?: string } | null;
}

function createSnapshot(address: string, fetchedAt = '2026-09-11T08:00:00.000Z'): WalletSnapshot {
  return {
    address,
    network: 'mainnet-beta',
    solBalanceLamports: 1_284_000_000n,
    tokenAccountCount: 14,
    nonZeroTokenAccountCount: 8,
    zeroBalanceTokenAccountCount: 6,
    fetchedAt,
  };
}

function createService(getSnapshot: WalletSnapshotService['getSnapshot']): WalletSnapshotService {
  return {
    network: 'mainnet-beta',
    endpoint: 'https://rpc.test',
    getSnapshot,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useWalletSnapshot', () => {
  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
  }

  function setupWallet(state: WalletState) {
    useWalletMock.mockImplementation(() => ({
      status: state.status,
      wallet: state.wallet,
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
    }));
  }

  it('stays idle and does not fetch while wallet is disconnected', async () => {
    const walletState: WalletState = { status: 'disconnected', wallet: null };
    setupWallet(walletState);
    const getSnapshot = vi.fn();
    const service = createService(getSnapshot);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSnapshot({ service });
      return null;
    }

    await act(async () => {
      create(<Harness />);
      await flushMicrotasks();
    });

    expect(latest.isConnected).toBe(false);
    expect(latest.address).toBeNull();
    expect(latest.status).toBe('idle');
    expect(latest.snapshot).toBeNull();
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('loads and stores snapshot for the connected wallet', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);
    const gate = deferred<WalletSnapshot>();
    const getSnapshot = vi.fn().mockReturnValue(gate.promise);
    const service = createService(getSnapshot);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSnapshot({ service });
      return null;
    }

    await act(async () => {
      create(<Harness />);
      await flushMicrotasks();
    });

    expect(latest.status).toBe('loading');
    expect(getSnapshot).toHaveBeenCalledWith(walletAddress);

    await act(async () => {
      gate.resolve(createSnapshot(walletAddress));
      await Promise.resolve();
    });

    expect(latest.status).toBe('success');
    expect(latest.snapshot?.address).toBe(walletAddress);
  });

  it('supports manual refresh without polling', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);
    const getSnapshot = vi
      .fn()
      .mockResolvedValueOnce(createSnapshot(walletAddress, '2026-09-11T08:00:00.000Z'))
      .mockResolvedValueOnce(createSnapshot(walletAddress, '2026-09-11T08:00:15.000Z'));
    const service = createService(getSnapshot);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSnapshot({ service });
      return null;
    }

    await act(async () => {
      create(<Harness />);
      await flushMicrotasks();
    });

    await act(async () => {
      await latest.refresh();
    });

    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(latest.snapshot?.fetchedAt).toBe('2026-09-11T08:00:15.000Z');
  });

  it('surfaces RPC errors and supports retry', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);

    const getSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error('Wallet snapshot is temporarily unavailable. Please try again.'))
      .mockResolvedValueOnce(createSnapshot(walletAddress));
    const service = createService(getSnapshot);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSnapshot({ service });
      return null;
    }

    await act(async () => {
      create(<Harness />);
      await flushMicrotasks();
    });

    expect(latest.status).toBe('error');
    expect(latest.error).toBe('Wallet snapshot is temporarily unavailable. Please try again.');

    await act(async () => {
      await latest.refresh();
    });

    expect(latest.status).toBe('success');
    expect(latest.error).toBeNull();
  });

  it('invalidates pending request when wallet disconnects', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);
    const gate = deferred<WalletSnapshot>();
    const getSnapshot = vi.fn().mockReturnValue(gate.promise);
    const service = createService(getSnapshot);

    let latest!: Controller;
    let renderer!: ReturnType<typeof create>;
    function Harness() {
      latest = useWalletSnapshot({ service });
      return null;
    }

    await act(async () => {
      renderer = create(<Harness />);
      await flushMicrotasks();
    });

    walletState.status = 'disconnected';
    walletState.wallet = null;

    await act(async () => {
      renderer.update(<Harness />);
    });

    expect(latest.status).toBe('idle');
    expect(latest.snapshot).toBeNull();

    await act(async () => {
      gate.resolve(createSnapshot(walletAddress));
      await flushMicrotasks();
    });

    expect(latest.status).toBe('idle');
    expect(latest.snapshot).toBeNull();
  });

  it('ignores stale response when wallet changes while request is pending', async () => {
    const addressA = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const addressB = '5eYxn8hYQvpgxQ6xVgdCBGxk2c8nAF8KvNfSGS2vyxuj';
    const walletState: WalletState = { status: 'connected', wallet: { address: addressA } };
    setupWallet(walletState);

    const gateA = deferred<WalletSnapshot>();
    const gateB = deferred<WalletSnapshot>();
    const getSnapshot = vi
      .fn()
      .mockReturnValueOnce(gateA.promise)
      .mockReturnValueOnce(gateB.promise);
    const service = createService(getSnapshot);

    let latest!: Controller;
    let renderer!: ReturnType<typeof create>;
    function Harness() {
      latest = useWalletSnapshot({ service });
      return null;
    }

    await act(async () => {
      renderer = create(<Harness />);
      await flushMicrotasks();
    });

    walletState.wallet = { address: addressB };

    await act(async () => {
      renderer.update(<Harness />);
      await flushMicrotasks();
    });

    await act(async () => {
      gateA.resolve(createSnapshot(addressA));
      await flushMicrotasks();
    });

    expect(latest.snapshot).toBeNull();
    expect(latest.status).toBe('loading');

    await act(async () => {
      gateB.resolve(createSnapshot(addressB));
      await flushMicrotasks();
    });

    expect(latest.status).toBe('success');
    expect(latest.snapshot?.address).toBe(addressB);
  });

  it('wallet isolation: refresh uses only read-only snapshot service', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const connect = vi.fn();
    const disconnect = vi.fn();
    const signTrainingMessage = vi.fn();
    const signMessages = vi.fn();
    const signTransactions = vi.fn();
    const signAndSendTransactions = vi.fn();
    const deauthorize = vi.fn();

    useWalletMock.mockImplementation(() => ({
      status: 'connected',
      wallet: { address: walletAddress },
      error: null,
      realMessageSigningEnabled: false,
      trainingSigningMessage: {
        nonce: '001122',
        displayMessage: 'TrainRekt Wallet Safety Training',
        messageBytes: new Uint8Array([1]),
      },
      signingStatus: 'idle',
      signingError: null,
      connect,
      disconnect,
      signTrainingMessage,
      signMessages,
      signTransactions,
      signAndSendTransactions,
      deauthorize,
    }));

    const getSnapshot = vi
      .fn()
      .mockResolvedValue(createSnapshot(walletAddress));
    const service = createService(getSnapshot);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSnapshot({ service });
      return null;
    }

    await act(async () => {
      create(<Harness />);
      await flushMicrotasks();
    });

    await act(async () => {
      await latest.refresh();
    });

    expect(getSnapshot).toHaveBeenCalledWith(walletAddress);
    expect(connect).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
    expect(signTrainingMessage).not.toHaveBeenCalled();
    expect(signMessages).not.toHaveBeenCalled();
    expect(signTransactions).not.toHaveBeenCalled();
    expect(signAndSendTransactions).not.toHaveBeenCalled();
    expect(deauthorize).not.toHaveBeenCalled();
  });
});
