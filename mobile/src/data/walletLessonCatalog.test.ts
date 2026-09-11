import { describe, expect, it } from 'vitest';

import { walletLessonCatalog } from './walletLessonCatalog';

describe('walletLessonCatalog', () => {
  it('includes a compact educational set for wallet-derived topics', () => {
    expect(walletLessonCatalog.length).toBeGreaterThanOrEqual(4);
    expect(walletLessonCatalog.length).toBeLessThanOrEqual(6);
  });

  it('keeps wallet lessons generic and free of real wallet addresses or token account identifiers', () => {
    const base58AddressPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
    walletLessonCatalog.forEach((exercise) => {
      const payload = JSON.stringify(exercise);
      expect(payload).not.toMatch(base58AddressPattern);
    });
  });
});
