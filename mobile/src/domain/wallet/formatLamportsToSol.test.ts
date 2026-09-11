import { describe, expect, it } from 'vitest';

import { formatLamportsToSol } from './formatLamportsToSol';

describe('formatLamportsToSol', () => {
  it('formats whole and fractional SOL from lamports', () => {
    expect(formatLamportsToSol(1_284_000_000n)).toBe('1.284');
    expect(formatLamportsToSol(42n)).toBe('0.000');
    expect(formatLamportsToSol(2_000_000_000n)).toBe('2.000');
  });
});
