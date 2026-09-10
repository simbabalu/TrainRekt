import { describe, expect, it } from 'vitest';

import { normalizeMwaAccountAddress } from './normalizeMwaAccountAddress';

describe('normalizeMwaAccountAddress', () => {
  it('converts a valid 32-byte base64 MWA address to canonical base58', () => {
    const base64Address = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const normalized = normalizeMwaAccountAddress(base64Address);

    expect(normalized).toBe('11111111111111111111111111111111');
  });

  it('rejects malformed base64 address input', () => {
    expect(() => normalizeMwaAccountAddress('not-base64%%%')).toThrow(
      'Wallet returned an invalid account address encoding.',
    );
  });

  it('rejects base64 that decodes to a non-32-byte value', () => {
    const tooShort = 'AQID';
    expect(() => normalizeMwaAccountAddress(tooShort)).toThrow(
      'Wallet returned an account address with an invalid byte length.',
    );
  });
});
