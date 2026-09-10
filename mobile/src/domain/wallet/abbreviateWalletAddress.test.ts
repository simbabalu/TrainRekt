import { describe, expect, it } from 'vitest';

import { abbreviateWalletAddress } from './abbreviateWalletAddress';

describe('abbreviateWalletAddress', () => {
  it('abbreviates a long wallet address for display', () => {
    expect(abbreviateWalletAddress('7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq')).toBe('7xKs...k9Wq');
  });

  it('returns short addresses unchanged', () => {
    expect(abbreviateWalletAddress('abc123')).toBe('abc123');
  });
});
