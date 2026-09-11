import { describe, expect, it } from 'vitest';

import { mobileWalletService } from './mobileWalletService';

describe('mobileWalletService unsupported fallback', () => {
  it('returns an unsupported result on non-Android platforms', async () => {
    const result = await mobileWalletService.connectWallet();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected unsupported connection result.');
    expect(result.reason).toBe('unsupported');
  });

  it('disconnect succeeds gracefully on unsupported platforms', async () => {
    const result = await mobileWalletService.disconnectWallet('ignored-token');
    expect(result).toEqual({ ok: true });
  });

  it('returns unsupported for signMessage on non-Android platforms', async () => {
    const result = await mobileWalletService.signMessage(new Uint8Array([1, 2, 3]), '11111111111111111111111111111111');
    expect(result).toEqual({
      ok: false,
      reason: 'unsupported',
      message: 'Message signing is only available on Android development builds.',
    });
  });
});
