import { describe, expect, it } from 'vitest';

import { toMwaBase64Address } from './toMwaBase64Address';

describe('toMwaBase64Address', () => {
  it('converts canonical base58 address to base64 transport format', () => {
    const base64Address = toMwaBase64Address('11111111111111111111111111111111');
    expect(base64Address).toBe('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
  });

  it('fails safely for malformed base58 input', () => {
    expect(() => toMwaBase64Address('not-a-wallet-address')).toThrow(
      'Wallet address is not a valid base58 public key.',
    );
  });
});
