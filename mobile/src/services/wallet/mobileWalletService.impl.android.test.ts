import { ed25519 } from '@noble/curves/ed25519.js';
import { base64FromUint8Array } from '@solana-mobile/mobile-wallet-adapter-protocol/encoding';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

function createSigningFixture(message: Uint8Array, seedOffset = 1) {
  const privateKey = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + seedOffset));
  const publicKeyBytes = ed25519.getPublicKey(privateKey);
  const base58Address = new PublicKey(publicKeyBytes).toBase58();
  const base64Address = base64FromUint8Array(publicKeyBytes);
  const signature = ed25519.sign(message, privateKey);
  return { base58Address, base64Address, signature };
}

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

  it('maps signMessage to MWA signMessages using base64 address and exact payload bytes', async () => {
    vi.resetModules();
    const message = new Uint8Array([1, 2, 3, 4]);
    const fixture = createSigningFixture(message);
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: fixture.base64Address }],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn().mockResolvedValue([fixture.signature]);
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({
      transact: transactMock,
    }));

    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(message, fixture.base58Address);

    expect(result).toEqual({ ok: true, signatureBytes: fixture.signature });
    expect(signMessagesMock).toHaveBeenCalledWith({
      addresses: [fixture.base64Address],
      payloads: [message],
    });
  });

  it('passes the exact reviewed message bytes to both signMessages and local verification', async () => {
    vi.resetModules();
    const message = new Uint8Array([10, 11, 12, 13]);
    const fixture = createSigningFixture(message);
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: fixture.base64Address }],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn().mockResolvedValue([fixture.signature]);
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });
    const verifyMock = vi.fn().mockReturnValue({ ok: true });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    vi.doMock('@/domain/wallet/verifyMessageSignature', () => ({ verifyMessageSignature: verifyMock }));

    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(message, fixture.base58Address);

    expect(result.ok).toBe(true);
    expect(signMessagesMock).toHaveBeenCalledTimes(1);
    expect(signMessagesMock.mock.calls[0][0].payloads[0]).toBe(message);
    expect(verifyMock).toHaveBeenCalledWith(fixture.base58Address, message, fixture.signature);
    expect(verifyMock.mock.calls[0][1]).toBe(message);

    vi.doUnmock('@/domain/wallet/verifyMessageSignature');
  });

  it('reauthorizes with auth token before signMessage when token is present', async () => {
    vi.resetModules();
    const message = new Uint8Array([9]);
    const fixture = createSigningFixture(message);
    const reauthorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: fixture.base64Address }],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn().mockResolvedValue([fixture.signature]);
    const transactMock = vi.fn(async (callback: (wallet: { reauthorize: typeof reauthorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ reauthorize: reauthorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));

    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(message, fixture.base58Address, 'auth-1');

    expect(result.ok).toBe(true);
    expect(reauthorizeMock).toHaveBeenCalledTimes(1);
    expect(signMessagesMock).toHaveBeenCalledTimes(1);
  });

  it('extracts signature when wallet returns message+signature payload', async () => {
    vi.resetModules();
    const message = new Uint8Array([41, 42, 43]);
    const fixture = createSigningFixture(message);
    const signature = fixture.signature;
    const signedPayload = new Uint8Array(message.length + signature.length);
    signedPayload.set(message, 0);
    signedPayload.set(signature, message.length);

    const authorizeMock = vi.fn().mockResolvedValue({ accounts: [{ address: fixture.base64Address }], auth_token: 'token-1' });
    const signMessagesMock = vi.fn().mockResolvedValue([signedPayload]);
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(message, fixture.base58Address);

    expect(result).toEqual({ ok: true, signatureBytes: signature });
  });

  it('requires authorized account to match connected wallet address before signing', async () => {
    vi.resetModules();
    const expectedFixture = createSigningFixture(new Uint8Array([1, 2, 3]));
    const mismatchedFixture = createSigningFixture(new TextEncoder().encode('mismatch'), 99);
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: mismatchedFixture.base64Address }],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn().mockResolvedValue([mismatchedFixture.signature]);
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(new Uint8Array([1, 2, 3]), expectedFixture.base58Address);

    expect(result).toEqual({
      ok: false,
      reason: 'account-mismatch',
      message: 'Wallet account does not match the connected identity.',
    });
    expect(signMessagesMock).not.toHaveBeenCalled();
  });

  it('fails closed when authorization returns no accounts before signing', async () => {
    vi.resetModules();
    const message = new Uint8Array([5, 6, 7]);
    const fixture = createSigningFixture(message);
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn();
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(message, fixture.base58Address);

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-response',
      message: 'Wallet returned an invalid signed message response.',
    });
    expect(signMessagesMock).not.toHaveBeenCalled();
  });

  it('fails closed when authorization account address is malformed', async () => {
    vi.resetModules();
    const fixture = createSigningFixture(new Uint8Array([8, 8, 8]));
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: 'not-base64%%%' }],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn();
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(new Uint8Array([8, 8, 8]), fixture.base58Address);

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-response',
      message: 'Wallet returned an invalid signed message response.',
    });
    expect(signMessagesMock).not.toHaveBeenCalled();
  });

  it('fails closed when authorization returns more than one account', async () => {
    vi.resetModules();
    const fixture = createSigningFixture(new Uint8Array([2, 4, 6]));
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: fixture.base64Address }, { address: fixture.base64Address }],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn();
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(new Uint8Array([2, 4, 6]), fixture.base58Address);

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-response',
      message: 'Wallet returned an invalid signed message response.',
    });
    expect(signMessagesMock).not.toHaveBeenCalled();
  });

  it('fails safely when signed payload message prefix does not match request payload', async () => {
    vi.resetModules();
    const fixture = createSigningFixture(new Uint8Array([1, 2]));
    const authorizeMock = vi.fn().mockResolvedValue({ accounts: [{ address: fixture.base64Address }], auth_token: 'token-1' });
    const signMessagesMock = vi.fn().mockResolvedValue([new Uint8Array([99, 1, 2, ...new Uint8Array(64).fill(1)])]);
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(new Uint8Array([1, 2]), fixture.base58Address);

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-response',
      message: 'Wallet returned an invalid signed message response.',
    });
  });

  it('fails closed when wallet returns multiple signed payloads for one request payload', async () => {
    vi.resetModules();
    const message = new Uint8Array([4, 5, 6]);
    const fixture = createSigningFixture(message);
    const authorizeMock = vi.fn().mockResolvedValue({ accounts: [{ address: fixture.base64Address }], auth_token: 'token-1' });
    const signMessagesMock = vi.fn().mockResolvedValue([fixture.signature, fixture.signature]);
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(message, fixture.base58Address);

    expect(result).toEqual({
      ok: false,
      reason: 'invalid-response',
      message: 'Wallet returned an invalid signed message response.',
    });
  });

  it('fails closed when signature verification fails in runtime sign flow', async () => {
    vi.resetModules();
    const message = new TextEncoder().encode('expected reviewed message');
    const wrongMessage = new TextEncoder().encode('different message');
    const fixture = createSigningFixture(wrongMessage);

    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: fixture.base64Address }],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn().mockResolvedValue([fixture.signature]);
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(message, fixture.base58Address);

    expect(result).toEqual({
      ok: false,
      reason: 'verification-failed',
      message: 'Signed message could not be verified against the connected wallet key.',
    });
  });

  it('never invokes transaction signing APIs in signMessage flow', async () => {
    vi.resetModules();
    const message = new Uint8Array([7, 7, 7]);
    const fixture = createSigningFixture(message);
    const authorizeMock = vi.fn().mockResolvedValue({
      accounts: [{ address: fixture.base64Address }],
      auth_token: 'token-1',
    });
    const signMessagesMock = vi.fn().mockResolvedValue([fixture.signature]);
    const signTransactionsMock = vi.fn();
    const signAndSendTransactionsMock = vi.fn();
    const transactMock = vi.fn(async (callback: (wallet: {
      authorize: typeof authorizeMock;
      signMessages: typeof signMessagesMock;
      signTransactions: typeof signTransactionsMock;
      signAndSendTransactions: typeof signAndSendTransactionsMock;
    }) => Promise<unknown>) => {
      return await callback({
        authorize: authorizeMock,
        signMessages: signMessagesMock,
        signTransactions: signTransactionsMock,
        signAndSendTransactions: signAndSendTransactionsMock,
      });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(message, fixture.base58Address);

    expect(result.ok).toBe(true);
    expect(signTransactionsMock).not.toHaveBeenCalled();
    expect(signAndSendTransactionsMock).not.toHaveBeenCalled();
  });

  it('maps signMessage cancellation errors safely', async () => {
    vi.resetModules();
    const transactMock = vi.fn(async () => {
      throw new Error('User cancelled');
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));
    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
    const result = await mobileWalletServiceImpl.signMessage(new Uint8Array([1]), '11111111111111111111111111111111');

    expect(result).toEqual({
      ok: false,
      reason: 'cancelled',
      message: 'Message signing was cancelled.',
    });
  });

  it('does not log message/signature payloads during signMessage flow', async () => {
    vi.resetModules();
    const message = new Uint8Array([1, 2, 3]);
    const fixture = createSigningFixture(message);
    const authorizeMock = vi.fn().mockResolvedValue({ accounts: [{ address: fixture.base64Address }], auth_token: 'token-1' });
    const signMessagesMock = vi.fn().mockResolvedValue([fixture.signature]);
    const transactMock = vi.fn(async (callback: (wallet: { authorize: typeof authorizeMock; signMessages: typeof signMessagesMock }) => Promise<unknown>) => {
      return await callback({ authorize: authorizeMock, signMessages: signMessagesMock });
    });

    vi.doMock('@solana-mobile/mobile-wallet-adapter-protocol-web3js', () => ({ transact: transactMock }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { mobileWalletServiceImpl } = await import('./mobileWalletService.impl.android');
  await mobileWalletServiceImpl.signMessage(message, fixture.base58Address);

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
