import { describe, expect, it } from 'vitest';

import { getHomeTrainingCta } from './getHomeTrainingCta';

describe('getHomeTrainingCta', () => {
  it('recommends starting daily training before the goal is complete', () => {
    expect(getHomeTrainingCta({ completed: 1, goal: 3, percentage: 33, isComplete: false })).toEqual({ mode: 'daily', label: 'START TRAINING' });
  });

  it('recommends extra practice once the daily goal is complete', () => {
    expect(getHomeTrainingCta({ completed: 3, goal: 3, percentage: 100, isComplete: true })).toEqual({ mode: 'practice', label: 'EXTRA PRACTICE' });
  });
});
