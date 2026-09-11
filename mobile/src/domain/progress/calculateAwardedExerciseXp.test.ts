import { describe, expect, it } from 'vitest';

import { calculateAwardedExerciseXp } from './calculateAwardedExerciseXp';

describe('calculateAwardedExerciseXp', () => {
  it('awards full base XP in daily mode', () => {
    expect(calculateAwardedExerciseXp({ baseXp: 120, mode: 'daily' })).toBe(120);
  });

  it('awards 25% practice XP with Math.round', () => {
    expect(calculateAwardedExerciseXp({ baseXp: 120, mode: 'practice' })).toBe(30);
    expect(calculateAwardedExerciseXp({ baseXp: 150, mode: 'practice' })).toBe(38);
    expect(calculateAwardedExerciseXp({ baseXp: 100, mode: 'practice' })).toBe(25);
  });

  it('keeps zero XP at zero and rejects negative/non-finite values', () => {
    expect(calculateAwardedExerciseXp({ baseXp: 0, mode: 'daily' })).toBe(0);
    expect(calculateAwardedExerciseXp({ baseXp: 0, mode: 'practice' })).toBe(0);
    expect(calculateAwardedExerciseXp({ baseXp: -120, mode: 'practice' })).toBe(0);
    expect(calculateAwardedExerciseXp({ baseXp: Number.NaN, mode: 'daily' })).toBe(0);
  });

  it('awards wallet Practice XP only for the first stable exercise attempt', () => {
    expect(calculateAwardedExerciseXp({ baseXp: 120, mode: 'practice', source: 'wallet', walletRewardAlreadyClaimed: false })).toBe(30);
    expect(calculateAwardedExerciseXp({
      baseXp: 120,
      mode: 'practice',
      source: 'wallet',
      walletRewardAlreadyClaimed: true,
    })).toBe(0);
  });

  it('does not suppress first attempts for another exercise or ordinary practice', () => {
    expect(calculateAwardedExerciseXp({ baseXp: 120, mode: 'practice', source: 'wallet', walletRewardAlreadyClaimed: false })).toBe(30);
    expect(calculateAwardedExerciseXp({ baseXp: 120, mode: 'practice', walletRewardAlreadyClaimed: true })).toBe(30);
  });
});