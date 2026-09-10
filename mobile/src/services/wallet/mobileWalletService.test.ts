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
});
