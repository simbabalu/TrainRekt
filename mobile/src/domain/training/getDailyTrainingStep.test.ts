import { describe, expect, it } from 'vitest';

import { createDefaultDailyTrainingState } from './normalizeDailyTrainingState';
import { getDailyTrainingStep } from './getDailyTrainingStep';

describe('getDailyTrainingStep', () => {
  it('shows decision 1 of 3 when no decisions have been completed', () => {
    const daily = createDefaultDailyTrainingState();
    expect(getDailyTrainingStep(daily)).toMatchObject({ currentStep: 1, totalSteps: 3, isComplete: false });
  });

  it('shows decision 2 of 3 after the first completed decision', () => {
    const daily = { ...createDefaultDailyTrainingState(), todayCompletedDecisions: 1 };
    expect(getDailyTrainingStep(daily)).toMatchObject({ currentStep: 2, totalSteps: 3 });
  });

  it('shows decision 3 of 3 after the second completed decision', () => {
    const daily = { ...createDefaultDailyTrainingState(), todayCompletedDecisions: 2 };
    expect(getDailyTrainingStep(daily)).toMatchObject({ currentStep: 3, totalSteps: 3 });
  });

  it('never reports a step beyond the daily goal once complete', () => {
    const daily = { ...createDefaultDailyTrainingState(), todayCompletedDecisions: 3, dailyGoalCompleted: true };
    expect(getDailyTrainingStep(daily)).toMatchObject({ currentStep: 3, totalSteps: 3, isComplete: true });
  });
});
