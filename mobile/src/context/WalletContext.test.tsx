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
});
