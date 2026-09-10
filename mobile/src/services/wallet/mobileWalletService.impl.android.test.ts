import { describe, expect, it, vi } from 'vitest';

describe('mobileWalletServiceImpl android hotfix behavior', () => {
  it('does not invoke native deauthorize during disconnect even when auth token exists', async () => {
    vi.resetModules();
    const transactMock = vi.fn();
    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({
      transact: transactMock,
    }));

    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.disconnectWallet('secret-auth-token');

    expect(result).toEqual({ ok: true });
    expect(transactMock).not.toHaveBeenCalled();
  });

  it('still starts authorize flow for connect', async () => {
    vi.resetModules();
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq', label: 'Wallet' as string | undefined }],
      auth_token: 'token-1' as string | undefined,
    });
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({
      transact: transactMock,
    }));

    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.connectWallet();

    expect(result).toEqual({
      ok: true,
      wallet: { address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq', label: 'Wallet' },
      authToken: 'token-1',
    });
    expect(transactMock).toHaveBeenCalledTimes(1);
    expect(authorizeMock).toHaveBeenCalledTimes(1);
  });
});
