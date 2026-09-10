import { describe, expect, it } from 'vitest';

import { getLocalDateKey } from './getLocalDateKey';

describe('getLocalDateKey', () => {
  it('formats a date using local calendar components, not UTC', () => {
    const localEveningDate = new Date(2026, 0, 15, 23, 30);
    expect(getLocalDateKey(localEveningDate)).toBe('2026-01-15');
  });

  it('pads single-digit months and days', () => {
    expect(getLocalDateKey(new Date(2026, 8, 5, 8, 0))).toBe('2026-09-05');
  });
});
