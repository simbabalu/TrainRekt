import { describe, expect, it } from 'vitest';

import { createDefaultDailyTrainingState } from './normalizeDailyTrainingState';
import { isDailyTrainingComplete } from './isDailyTrainingComplete';

describe('isDailyTrainingComplete', () => {
  it('is false before the daily goal is reached', () => {
    const daily = { ...createDefaultDailyTrainingState(), dailyGoalCompleted: false };
    expect(isDailyTrainingComplete(daily, 'daily')).toBe(false);
  });

  it('is true once the daily goal has been completed in daily mode', () => {
    const daily = { ...createDefaultDailyTrainingState(), dailyGoalCompleted: true };
    expect(isDailyTrainingComplete(daily, 'daily')).toBe(true);
  });

  it('is always false in practice mode regardless of daily completion', () => {
    const daily = { ...createDefaultDailyTrainingState(), dailyGoalCompleted: true };
    expect(isDailyTrainingComplete(daily, 'practice')).toBe(false);
  });
});
