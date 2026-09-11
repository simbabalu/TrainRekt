import { describe, expect, it } from 'vitest';

import { calculateSurpriseDelayMs } from './calculateSurpriseDelayMs';

describe('calculateSurpriseDelayMs', () => {
  it('returns zero when delay is omitted', () => {
    expect(calculateSurpriseDelayMs(undefined, 0.5)).toBe(0);
  });

  it('clamps random ratio to 0..1 and returns value within inclusive range', () => {
    expect(calculateSurpriseDelayMs({ minMs: 1500, maxMs: 3000 }, -1)).toBe(1500);
    expect(calculateSurpriseDelayMs({ minMs: 1500, maxMs: 3000 }, 2)).toBe(3000);
  });

  it('normalizes inverted ranges safely', () => {
    expect(calculateSurpriseDelayMs({ minMs: 3000, maxMs: 1500 }, 0.5)).toBe(3000);
  });
});
