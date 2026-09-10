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
      accounts: [{ address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'Wallet' as string | undefined }],
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
      wallet: { address: '11111111111111111111111111111111', label: 'Wallet' },
      authToken: 'token-1',
    });
    expect(transactMock).toHaveBeenCalledTimes(1);
    expect(authorizeMock).toHaveBeenCalledTimes(1);
  });

  it('returns a failed result when authorize returns malformed base64 account address', async () => {
    vi.resetModules();
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: 'not-base64%%%', label: 'Wallet' as string | undefined }],
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
      ok: false,
      reason: 'failed',
      message: 'Wallet returned an invalid account address encoding.',
    });
    expect(authorizeMock).toHaveBeenCalledTimes(1);
  });

  it('returns a failed result when decoded account address length is not 32 bytes', async () => {
    vi.resetModules();
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: 'AQID', label: 'Wallet' as string | undefined }],
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
      ok: false,
      reason: 'failed',
      message: 'Wallet returned an account address with an invalid byte length.',
    });
    expect(authorizeMock).toHaveBeenCalledTimes(1);
  });

  it('does not log auth tokens during connect flow', async () => {
    vi.resetModules();
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'Wallet' as string | undefined }],
      auth_token: 'secret-auth-token' as string | undefined,
    });
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({
      transact: transactMock,
    }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    await mobileWalletServiceImpl.connectWallet();

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
