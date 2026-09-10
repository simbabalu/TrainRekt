import { describe, expect, it } from 'vitest';

import { applyDailyTrainingCompletion } from './applyDailyTrainingCompletion';
import { calculateDailyGoalProgress } from './calculateDailyGoalProgress';
import { createDefaultDailyTrainingState, normalizeDailyTrainingState } from './normalizeDailyTrainingState';
import { TrainingMode } from '@/types/training';

const day1 = new Date(2026, 8, 10, 9, 0);
const day2 = new Date(2026, 8, 11, 9, 0);
const day4 = new Date(2026, 8, 14, 9, 0);

function completeDecisions(count: number, now: Date, startingDaily = createDefaultDailyTrainingState(now), mode: TrainingMode = 'daily') {
  let daily = startingDaily;
  let bonusXpAwarded = 0;
  for (let index = 0; index < count; index += 1) {
    const result = applyDailyTrainingCompletion(daily, mode, now);
    daily = result.daily;
    bonusXpAwarded += result.bonusXpAwarded;
  }
  return { daily, bonusXpAwarded };
}

describe('applyDailyTrainingCompletion', () => {
  it('increments todays completed decisions on the first completion', () => {
    const initial = createDefaultDailyTrainingState(day1);
    const { daily, bonusXpAwarded } = applyDailyTrainingCompletion(initial, 'daily', day1);

    expect(daily.todayCompletedDecisions).toBe(1);
    expect(daily.dailyGoalCompleted).toBe(false);
    expect(bonusXpAwarded).toBe(0);
  });

  it('completes the goal on the third decision and awards the bonus once', () => {
    const { daily, bonusXpAwarded } = completeDecisions(3, day1);

    expect(daily.todayCompletedDecisions).toBe(3);
    expect(daily.dailyGoalCompleted).toBe(true);
    expect(bonusXpAwarded).toBe(150);
    expect(calculateDailyGoalProgress(daily)).toMatchObject({ completed: 3, goal: 3, isComplete: true });
  });

  it('does not award the bonus again and caps the counter on a fourth daily decision the same day', () => {
    const afterGoal = completeDecisions(3, day1).daily;
    const fourth = applyDailyTrainingCompletion(afterGoal, 'daily', day1);

    expect(fourth.daily.todayCompletedDecisions).toBe(3);
    expect(fourth.bonusXpAwarded).toBe(0);
  });

  it('does not increment the daily streak twice for the same calendar day', () => {
    const afterGoal = completeDecisions(3, day1).daily;
    const streakAfterGoal = afterGoal.dailyTrainingStreak;
    const afterMore = completeDecisions(3, day1, afterGoal).daily;

    expect(afterMore.dailyTrainingStreak).toBe(streakAfterGoal);
  });

  it('increments the daily streak when completing today after completing yesterday', () => {
    const afterDay1 = completeDecisions(3, day1).daily;
    expect(afterDay1.dailyTrainingStreak).toBe(1);

    const rolledIntoDay2 = normalizeDailyTrainingState(afterDay1, day2);
    const afterDay2 = completeDecisions(3, day2, rolledIntoDay2).daily;

    expect(afterDay2.dailyTrainingStreak).toBe(2);
  });

  it('resets the daily streak to 1 after missing one or more days', () => {
    const afterDay1 = completeDecisions(3, day1).daily;
    const rolledIntoDay4 = normalizeDailyTrainingState(afterDay1, day4);
    const afterDay4 = completeDecisions(3, day4, rolledIntoDay4).daily;

    expect(afterDay4.dailyTrainingStreak).toBe(1);
  });

  it('preserves the best daily streak after a later reset streak', () => {
    const afterDay1 = completeDecisions(3, day1).daily;
    const afterDay2 = completeDecisions(3, day2, normalizeDailyTrainingState(afterDay1, day2)).daily;
    expect(afterDay2.bestDailyTrainingStreak).toBe(2);

    const afterDay4 = completeDecisions(3, day4, normalizeDailyTrainingState(afterDay2, day4)).daily;

    expect(afterDay4.dailyTrainingStreak).toBe(1);
    expect(afterDay4.bestDailyTrainingStreak).toBe(2);
  });

  it('rolls over to a new local day and resets todays count without losing streak history', () => {
    const afterDay1 = completeDecisions(3, day1).daily;
    const rolledOver = normalizeDailyTrainingState(afterDay1, day2);

    expect(rolledOver.todayCompletedDecisions).toBe(0);
    expect(rolledOver.dailyGoalCompleted).toBe(false);
    expect(rolledOver.dailyTrainingStreak).toBe(1);
    expect(rolledOver.lastDailyCompletionDate).not.toBeNull();
  });

  it('leaves the counter at the goal for an extra-practice decision taken at 3/3', () => {
    const afterGoal = completeDecisions(3, day1).daily;
    const practiceResult = applyDailyTrainingCompletion(afterGoal, 'practice', day1);

    expect(practiceResult.daily.todayCompletedDecisions).toBe(3);
    expect(practiceResult.bonusXpAwarded).toBe(0);
  });

  it('does not increment the daily streak or flip completion back for extra practice', () => {
    const afterGoal = completeDecisions(3, day1).daily;
    const practiceResult = applyDailyTrainingCompletion(afterGoal, 'practice', day1);

    expect(practiceResult.daily.dailyTrainingStreak).toBe(afterGoal.dailyTrainingStreak);
    expect(practiceResult.daily.dailyGoalCompleted).toBe(true);
  });
});
