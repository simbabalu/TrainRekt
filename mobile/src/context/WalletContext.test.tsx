import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { MobileWalletService } from '@/services/wallet/mobileWalletService';
import { useWallet } from '@/hooks/useWallet';
import { WalletProvider } from './WalletContext';

type WalletController = ReturnType<typeof useWallet>;

function createMockService(): MobileWalletService {
  return {
    connectWallet: vi.fn(),
    disconnectWallet: vi.fn(),
    signMessage: vi.fn(),
  };
}

describe('WalletProvider', () => {
  it('starts disconnected', async () => {
    const service = createMockService();
    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    expect(wallet.status).toBe('disconnected');
    expect(wallet.wallet).toBeNull();
    expect(wallet.error).toBeNull();
  });

  it('stores only public wallet data after successful connection', async () => {
    const service = createMockService();
    vi.mocked(service.connectWallet).mockResolvedValue({
      ok: true,
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq', label: 'Primary Wallet' },
      authToken: 'secret-auth-token',
    });

    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    await act(async () => {
      await wallet.connect();
    });

    expect(wallet.status).toBe('connected');
    expect(wallet.wallet).toEqual({ address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq', label: 'Primary Wallet' });
    expect(Object.prototype.hasOwnProperty.call(wallet.wallet ?? {}, 'authToken')).toBe(false);
    expect(wallet.error).toBeNull();
  });

  it('disconnect clears connected wallet state', async () => {
    const service = createMockService();
    vi.mocked(service.connectWallet).mockResolvedValue({
      ok: true,
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq' },
      authToken: 'secret-auth-token',
    });
    vi.mocked(service.disconnectWallet).mockResolvedValue({ ok: true });

    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    await act(async () => {
      await wallet.connect();
      await wallet.disconnect();
    });

    expect(service.disconnectWallet).toHaveBeenCalledTimes(1);
    expect(wallet.status).toBe('disconnected');
    expect(wallet.wallet).toBeNull();
    expect(wallet.error).toBeNull();
  });

  it('clears the in-memory auth token after disconnect', async () => {
    const service = createMockService();
    vi.mocked(service.connectWallet).mockResolvedValue({
      ok: true,
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq' },
      authToken: 'secret-auth-token',
    });
    vi.mocked(service.disconnectWallet).mockResolvedValue({ ok: true });

    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    await act(async () => {
      await wallet.connect();
      await wallet.disconnect();
      await wallet.disconnect();
    });

    expect(service.disconnectWallet).toHaveBeenNthCalledWith(1, 'secret-auth-token');
    expect(service.disconnectWallet).toHaveBeenNthCalledWith(2, undefined);
    expect(wallet.status).toBe('disconnected');
    expect(wallet.wallet).toBeNull();
  });

  it('can reconnect with a fresh authorize flow after local disconnect', async () => {
    const service = createMockService();
    vi.mocked(service.connectWallet)
      .mockResolvedValueOnce({
        ok: true,
        wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq' },
        authToken: 'first-token',
      })
      .mockResolvedValueOnce({
        ok: true,
        wallet: { address: '9mAbKjA24sPuPqYxWwBfQ9cj2k9Zz' },
        authToken: 'second-token',
      });
    vi.mocked(service.disconnectWallet).mockResolvedValue({ ok: true });

    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    await act(async () => {
      await wallet.connect();
      await wallet.disconnect();
      await wallet.connect();
    });

    expect(service.connectWallet).toHaveBeenCalledTimes(2);
    expect(wallet.status).toBe('connected');
    expect(wallet.wallet).toEqual({ address: '9mAbKjA24sPuPqYxWwBfQ9cj2k9Zz' });
  });

  it('returns to disconnected state when authorization is cancelled', async () => {
    const service = createMockService();
    vi.mocked(service.connectWallet).mockResolvedValue({
      ok: false,
      reason: 'cancelled',
      message: 'Wallet connection cancelled.',
    });

    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    await act(async () => {
      await wallet.connect();
    });

    expect(wallet.status).toBe('disconnected');
    expect(wallet.wallet).toBeNull();
    expect(wallet.error).toBe('Wallet connection cancelled.');
  });

  it('surfaces a safe error status when authorization fails', async () => {
    const service = createMockService();
    vi.mocked(service.connectWallet).mockResolvedValue({
      ok: false,
      reason: 'failed',
      message: 'Wallet connection failed. Please try again.',
    });

    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    await act(async () => {
      await wallet.connect();
    });

    expect(wallet.status).toBe('error');
    expect(wallet.wallet).toBeNull();
    expect(wallet.error).toBe('Wallet connection failed. Please try again.');
  });

  it('prevents duplicate connect attempts', async () => {
    const service = createMockService();
    let resolveConnect!: (value: Awaited<ReturnType<MobileWalletService['connectWallet']>>) => void;

    vi.mocked(service.connectWallet).mockImplementation(() => new Promise((resolve) => {
      resolveConnect = resolve;
    }));

    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    await act(async () => {
      void wallet.connect();
      void wallet.connect();
      await Promise.resolve();
    });

    expect(service.connectWallet).toHaveBeenCalledTimes(1);
    expect(wallet.status).toBe('connecting');

    await act(async () => {
      resolveConnect({ ok: true, wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq' } });
      await Promise.resolve();
    });

    expect(wallet.status).toBe('connected');
  });

  it('does not call service.signMessage while real signing gate is disabled', async () => {
    const service = createMockService();
    vi.mocked(service.connectWallet).mockResolvedValue({
      ok: true,
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq' },
      authToken: 'auth-1',
    });
    vi.mocked(service.signMessage).mockResolvedValue({ ok: true, signatureBytes: new Uint8Array(64) });

    let wallet!: WalletController;

    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    await act(async () => {
      await wallet.connect();
    });

    const result = await wallet.signTrainingMessage();

    expect(result).toEqual({
      ok: false,
      reason: 'disabled',
      message: 'Real wallet signing is disabled while TrainRekt is being validated.',
    });
    expect(service.signMessage).not.toHaveBeenCalled();
  });

  it('keeps sign gate disabled even when running in DEV mode', async () => {
    const service = createMockService();
    const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
    Object.defineProperty(globalThis, '__DEV__', {
      value: true,
      configurable: true,
    });

    let wallet!: WalletController;
    function Harness() {
      wallet = useWallet();
      return null;
    }

    await act(async () => {
      create(<WalletProvider service={service}><Harness /></WalletProvider>);
    });

    const result = await wallet.signTrainingMessage();

    expect(wallet.realMessageSigningEnabled).toBe(false);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected real signing to remain disabled.');
    expect(result.reason).toBe('disabled');
    expect(service.signMessage).not.toHaveBeenCalled();

    Object.defineProperty(globalThis, '__DEV__', {
      value: originalDev,
      configurable: true,
    });
  });
});
