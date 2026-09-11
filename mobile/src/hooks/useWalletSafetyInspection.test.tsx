import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { WalletSafetyInspectionProvider } from '@/context/WalletSafetyInspectionContext';
import type { WalletInspectionService } from '@/services/solana/walletInspectionService';
import type { WalletConnectionStatus } from '@/types/wallet';
import type { WalletSafetyInspection } from '@/types/walletInspection';
import { useWalletSafetyInspection } from './useWalletSafetyInspection';

const useWalletMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useWallet', () => ({
  useWallet: useWalletMock,
}));

type Controller = ReturnType<typeof useWalletSafetyInspection>;

interface WalletState {
  status: WalletConnectionStatus;
  wallet: { address: string; label?: string } | null;
}

function createInspection(address: string, warnings: string[] = []): WalletSafetyInspection {
  return {
    address,
    network: 'mainnet-beta',
    inspectedAt: '2026-09-11T10:00:00.000Z',
    warnings,
    mintInspections: [],
    tokenAccounts: [],
  };
}

function createService(getInspection: WalletInspectionService['getInspection']): WalletInspectionService {
  return {
    network: 'mainnet-beta',
    endpoint: 'https://rpc.test',
    getInspection,
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

describe('useWalletSafetyInspection', () => {
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
      signMessages: vi.fn(),
      signTransactions: vi.fn(),
      signAndSendTransactions: vi.fn(),
      deauthorize: vi.fn(),
    }));
  }

  it('stays idle while wallet is disconnected', async () => {
    const walletState: WalletState = { status: 'disconnected', wallet: null };
    setupWallet(walletState);
    const getInspection = vi.fn();
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service });
      return null;
    }

    await act(async () => {
      create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.status).toBe('idle');
    expect(latest.viewMode).toBe('collapsed');
    expect(latest.inspection).toBeNull();
    expect(getInspection).not.toHaveBeenCalled();
  });

  it('supports typed view mode changes', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);

    const getInspection = vi.fn().mockResolvedValue(createInspection(walletAddress));
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service });
      return null;
    }

    await act(async () => {
      create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.viewMode).toBe('collapsed');

    await act(async () => {
      latest.setViewMode('informational');
      await flushMicrotasks();
    });

    expect(latest.viewMode).toBe('informational');

    await act(async () => {
      await latest.refresh();
      await flushMicrotasks();
    });

    expect(latest.viewMode).toBe('collapsed');
  });

  it('loads inspection for connected wallet', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);

    const gate = deferred<WalletSafetyInspection>();
    const getInspection = vi.fn().mockReturnValue(gate.promise);
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service });
      return null;
    }

    await act(async () => {
      create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.status).toBe('loading');

    await act(async () => {
      gate.resolve(createInspection(walletAddress));
      await flushMicrotasks();
    });

    expect(latest.status).toBe('success');
    expect(latest.inspection?.address).toBe(walletAddress);
  });

  it('marks status as partial when inspection returns non-fatal warnings', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);

    const getInspection = vi.fn().mockResolvedValue(createInspection(walletAddress, ['Token-2022 account inspection could not be completed.']));
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service });
      return null;
    }

    await act(async () => {
      create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.status).toBe('partial');
    expect(latest.inspection?.warnings).toHaveLength(1);
  });

  it('surfaces inspection errors as unavailable while keeping wallet connected', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);

    const getInspection = vi.fn().mockRejectedValue(new Error('Wallet inspection is temporarily unavailable. Please try again.'));
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service });
      return null;
    }

    await act(async () => {
      create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.status).toBe('unavailable');
    expect(latest.error).toBe('Wallet inspection is temporarily unavailable. Please try again.');
    expect(latest.isConnected).toBe(true);
  });

  it('wallet isolation: inspection refresh does not invoke signing, transactions, or deauthorize', async () => {
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

    const getInspection = vi.fn().mockResolvedValue(createInspection(walletAddress));
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service });
      return null;
    }

    await act(async () => {
      create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    await act(async () => {
      await latest.refresh();
    });

    expect(getInspection).toHaveBeenCalledWith(walletAddress);
    expect(connect).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
    expect(signTrainingMessage).not.toHaveBeenCalled();
    expect(signMessages).not.toHaveBeenCalled();
    expect(signTransactions).not.toHaveBeenCalled();
    expect(signAndSendTransactions).not.toHaveBeenCalled();
    expect(deauthorize).not.toHaveBeenCalled();
  });

  it('prevents duplicate in-flight refresh requests', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);

    const gate = deferred<WalletSafetyInspection>();
    const getInspection = vi.fn().mockReturnValue(gate.promise);
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service, autoFetch: false });
      return null;
    }

    await act(async () => {
      create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    await act(async () => {
      void latest.refresh();
      void latest.refresh();
      await flushMicrotasks();
    });

    expect(getInspection).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve(createInspection(walletAddress));
      await flushMicrotasks();
    });

    expect(latest.status).toBe('success');
  });

  it('hides previous wallet inspection when connected wallet address changes', async () => {
    const walletA = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletB = '91z5dwTn8xEoBvP4V2g6xKBQmChjkBYWLC2N4dJ8KqzM';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletA } };
    setupWallet(walletState);

    const getInspection = vi.fn().mockImplementation(async (address: string) => createInspection(address));
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service });
      return null;
    }

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.inspection?.address).toBe(walletA);

    walletState.wallet = { address: walletB };
    await act(async () => {
      renderer.update(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.inspection?.address).toBe(walletB);
  });

  it('hides previous wallet inspection when wallet disconnects', async () => {
    const walletAddress = '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH';
    const walletState: WalletState = { status: 'connected', wallet: { address: walletAddress } };
    setupWallet(walletState);

    const getInspection = vi.fn().mockResolvedValue(createInspection(walletAddress));
    const service = createService(getInspection);

    let latest!: Controller;
    function Harness() {
      latest = useWalletSafetyInspection({ service });
      return null;
    }

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.inspection?.address).toBe(walletAddress);

    walletState.status = 'disconnected';
    walletState.wallet = null;
    await act(async () => {
      renderer.update(<WalletSafetyInspectionProvider><Harness /></WalletSafetyInspectionProvider>);
      await flushMicrotasks();
    });

    expect(latest.isConnected).toBe(false);
    expect(latest.inspection).toBeNull();
  });
});
