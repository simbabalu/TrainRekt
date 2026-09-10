import { describe, expect, it } from 'vitest';

import { getWalletDisplayIdentity } from './getWalletDisplayIdentity';

describe('getWalletDisplayIdentity', () => {
  it('shows label as primary and abbreviated address as secondary when label exists', () => {
    const display = getWalletDisplayIdentity({
      address: '8HkKjA24sPuPqYxWwBfQ9cj2k9xP2',
      label: 'pascalschaer.skr',
    });

    expect(display).toEqual({
      primary: 'pascalschaer.skr',
      secondary: '8HkK...9xP2',
    });
  });

  it('falls back to abbreviated address when label is absent', () => {
    const display = getWalletDisplayIdentity({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq',
    });

    expect(display).toEqual({
      primary: '7xKs...k9Wq',
    });
  });

  it('ignores empty label values and still falls back to abbreviated address', () => {
    const display = getWalletDisplayIdentity({
      address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9Wq',
      label: '   ',
    });

    expect(display).toEqual({
      primary: '7xKs...k9Wq',
    });
  });
});
