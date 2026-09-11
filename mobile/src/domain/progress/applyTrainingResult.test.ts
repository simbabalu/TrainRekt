import { describe, expect, it } from 'vitest';

import { mockProgress } from '@/data/mockProgress';
import { scenarioCatalog } from '@/data/scenarioCatalog';
import { findWalletLessonExercise } from '@/data/walletLessonCatalog';
import { createDefaultDailyTrainingState } from '@/domain/training/normalizeDailyTrainingState';
import { applyTrainingResult } from './applyTrainingResult';
import { calculateLevel, calculateProgressPercentage, createProgressSnapshot, calculateWinRate } from './calculateLevel';
import { formatPercentage } from './formatPercentage';
import { evaluateDecision } from '@/domain/training/evaluateDecision';
import { DecisionExercise, TrainingExerciseResult } from '@/types/exercise';

const scenario: DecisionExercise = { ...scenarioCatalog[0], type: 'decision' };
const walletExercise = findWalletLessonExercise('wallet-lesson-frozen-account-state')!;
const metadata = { historyId: 'test-history', timestamp: '2026-09-10T12:00:00.000Z', mode: 'daily' as const };

describe('progress calculations', () => {
  it('calculates level boundaries from total XP', () => {
    expect(calculateLevel(0).level).toBe(1);
    expect(calculateLevel(999)).toMatchObject({ level: 1, xpIntoCurrentLevel: 999, xpToNextLevel: 1 });
    expect(calculateLevel(1000)).toMatchObject({ level: 2, xpIntoCurrentLevel: 0, xpToNextLevel: 1000 });
    expect(calculateLevel(1001)).toMatchObject({ level: 2, xpIntoCurrentLevel: 1, xpToNextLevel: 999 });
    expect(calculateLevel(1999)).toMatchObject({ level: 2, xpIntoCurrentLevel: 999, xpToNextLevel: 1 });
    expect(calculateLevel(2000)).toMatchObject({ level: 3, xpIntoCurrentLevel: 0, xpToNextLevel: 1000 });
  });

  it('derives one normalized percentage for the card text and progress bar', () => {
    expect(calculateProgressPercentage(0, 1000)).toBe(0);
    expect(calculateProgressPercentage(120, 1000)).toBe(12);
    expect(calculateProgressPercentage(72, 1000)).toBe(7.199999999999999);
    expect(formatPercentage(calculateProgressPercentage(72, 1000))).toBe('7.2');
    expect(formatPercentage(calculateProgressPercentage(120, 1000))).toBe('12');
    expect(calculateProgressPercentage(1200, 1000)).toBe(100);
  });

  it('calculates win rate from correct and wrong decisions', () => {
    expect(calculateWinRate(0, 0)).toBe(0);
    expect(calculateWinRate(34, 25)).toBe(58);
  });

  it('applies a correct result, streak, best streak, skill score, and history entry', () => {
    const result = evaluateDecision(scenario, scenario.correctOptionId);
    const initial = { ...mockProgress, currentStreak: 2, bestStreak: 2 };
    const updated = applyTrainingResult(initial, scenario, result, metadata);

    expect(updated.totalXp).toBe(initial.totalXp + 120);
    expect(updated.sessionsCompleted).toBe(initial.sessionsCompleted + 1);
    expect(updated.correctDecisions).toBe(initial.correctDecisions + 1);
    expect(updated.currentStreak).toBe(3);
    expect(updated.bestStreak).toBe(3);
    expect(updated.skillScores.profitTaking).toBe(67);
    expect(updated.recentTrainingHistory[0]).toMatchObject({ id: metadata.historyId, correct: true, xpEarned: 120 });
  });

  it('applies an incorrect result, resets streak, and reduces skill score', () => {
    const result = evaluateDecision(scenario, 'hold');
    const initial = { ...mockProgress, currentStreak: 4, bestStreak: 6 };
    const updated = applyTrainingResult(initial, scenario, result, metadata);

    expect(updated.totalXp).toBe(initial.totalXp + 30);
    expect(updated.wrongDecisions).toBe(initial.wrongDecisions + 1);
    expect(updated.currentStreak).toBe(0);
    expect(updated.bestStreak).toBe(6);
    expect(updated.skillScores.profitTaking).toBe(64);
  });

  it('clamps skill scores between zero and one hundred', () => {
    const result = evaluateDecision(scenario, scenario.correctOptionId);
    const high = applyTrainingResult({ ...mockProgress, skillScores: { ...mockProgress.skillScores, profitTaking: 100 } }, scenario, result, metadata);
    const wrongResult = evaluateDecision(scenario, 'hold');
    const low = applyTrainingResult({ ...mockProgress, skillScores: { ...mockProgress.skillScores, profitTaking: 0 } }, scenario, wrongResult, metadata);

    expect(high.skillScores.profitTaking).toBe(100);
    expect(low.skillScores.profitTaking).toBe(0);
  });

  it('keeps history newest-first and limits it to ten entries', () => {
    const history = Array.from({ length: 10 }, (_, index) => ({ ...mockProgress.recentTrainingHistory[0], id: `existing-${index}` }));
    const updated = applyTrainingResult({ ...mockProgress, recentTrainingHistory: history }, scenario, evaluateDecision(scenario, scenario.correctOptionId), metadata);

    expect(updated.recentTrainingHistory).toHaveLength(10);
    expect(updated.recentTrainingHistory[0].id).toBe(metadata.historyId);
    expect(updated.recentTrainingHistory.some((entry) => entry.id === 'existing-0')).toBe(true);
    expect(updated.recentTrainingHistory.some((entry) => entry.id === 'existing-9')).toBe(false);
  });

  it('claims a wallet lesson reward on the first wallet-origin completion', () => {
    const initial = { ...mockProgress, walletLessonRewards: { claimedExerciseIds: [] } };
    const result: TrainingExerciseResult = {
      isCorrect: false,
      xpEarned: 8,
      title: 'Incorrect',
      explanation: 'First wallet lesson attempt consumes the one-time reward claim.',
    };
    const updated = applyTrainingResult(initial, walletExercise, result, {
      historyId: 'wallet-h1',
      timestamp: '2026-09-11T12:00:00.000Z',
      mode: 'practice',
      source: 'wallet',
    });

    expect(updated.walletLessonRewards.claimedExerciseIds).toContain(walletExercise.id);
  });

  it('does not duplicate an existing wallet lesson reward claim', () => {
    const initial = {
      ...mockProgress,
      walletLessonRewards: { claimedExerciseIds: [walletExercise.id] },
    };
    const result: TrainingExerciseResult = {
      isCorrect: true,
      xpEarned: 0,
      title: 'Correct',
      explanation: 'Retry remains zero XP after reward claim.',
    };
    const updated = applyTrainingResult(initial, walletExercise, result, {
      historyId: 'wallet-h2',
      timestamp: '2026-09-11T12:00:10.000Z',
      mode: 'practice',
      source: 'wallet',
    });

    expect(updated.walletLessonRewards.claimedExerciseIds).toEqual([walletExercise.id]);
  });

  it('updates walletLessonProgress on every wallet-origin attempt and keeps only the latest result', () => {
    const failed: TrainingExerciseResult = {
      isCorrect: false,
      xpEarned: 8,
      title: 'Incorrect',
      explanation: 'Needs review.',
    };
    const passed: TrainingExerciseResult = {
      isCorrect: true,
      xpEarned: 0,
      title: 'Correct',
      explanation: 'Good choice.',
    };

    const afterFirst = applyTrainingResult(mockProgress, walletExercise, failed, {
      historyId: 'wallet-progress-1',
      timestamp: '2026-09-11T12:00:00.000Z',
      mode: 'practice',
      source: 'wallet',
    });
    expect(afterFirst.walletLessonProgress[walletExercise.id]).toEqual({ passed: false, completedAt: '2026-09-11T12:00:00.000Z' });

    const afterSecond = applyTrainingResult(afterFirst, walletExercise, passed, {
      historyId: 'wallet-progress-2',
      timestamp: '2026-09-11T12:01:00.000Z',
      mode: 'practice',
      source: 'wallet',
    });
    expect(afterSecond.walletLessonProgress[walletExercise.id]).toEqual({ passed: true, completedAt: '2026-09-11T12:01:00.000Z' });

    const afterThird = applyTrainingResult(afterSecond, walletExercise, failed, {
      historyId: 'wallet-progress-3',
      timestamp: '2026-09-11T12:02:00.000Z',
      mode: 'practice',
      source: 'wallet',
    });
    expect(afterThird.walletLessonProgress[walletExercise.id]).toEqual({ passed: false, completedAt: '2026-09-11T12:02:00.000Z' });
  });

  it('does not update walletLessonProgress for non-wallet training attempts', () => {
    const initial = {
      ...mockProgress,
      walletLessonProgress: {
        [walletExercise.id]: {
          passed: false,
          completedAt: '2026-09-11T08:00:00.000Z',
        },
      },
    };
    const updated = applyTrainingResult(initial, scenario, evaluateDecision(scenario, scenario.correctOptionId), {
      historyId: 'non-wallet',
      timestamp: '2026-09-11T13:00:00.000Z',
      mode: 'practice',
      source: 'adaptive',
    });

    expect(updated.walletLessonProgress).toEqual(initial.walletLessonProgress);
  });

  it('derives the complete progress snapshot without storing duplicate calculations', () => {
    const snapshot = createProgressSnapshot({ ...mockProgress, totalXp: 2742 });

    expect(snapshot).toMatchObject({ level: 3, xpIntoCurrentLevel: 742, xpRequiredForNextLevel: 1000, progressPercentage: 74.2, winRate: 58 });
  });

  it('increments todays completed decisions and awards the daily bonus exactly once when the goal is reached', () => {
    const now = new Date(2026, 8, 10, 9, 0);
    let progressState = { ...mockProgress, daily: createDefaultDailyTrainingState(now) };
    const submit = () => applyTrainingResult(progressState, scenario, evaluateDecision(scenario, scenario.correctOptionId), { historyId: `h-${progressState.daily.todayCompletedDecisions}`, timestamp: now.toISOString(), mode: 'daily' });

    progressState = submit();
    expect(progressState.daily.todayCompletedDecisions).toBe(1);

    progressState = submit();
    const xpBeforeThird = progressState.totalXp;

    progressState = submit();
    expect(progressState.daily.dailyGoalCompleted).toBe(true);
    expect(progressState.totalXp).toBe(xpBeforeThird + scenario.xpReward + 150);

    const xpAfterGoal = progressState.totalXp;
    progressState = submit();
    expect(progressState.totalXp).toBe(xpAfterGoal + scenario.xpReward);
  });

  it('rolls the day over without destroying total XP, skills, or history', () => {
    const day1 = new Date(2026, 8, 10, 9, 0);
    const day2 = new Date(2026, 8, 11, 9, 0);
    let progressState = { ...mockProgress, daily: createDefaultDailyTrainingState(day1) };

    progressState = applyTrainingResult(progressState, scenario, evaluateDecision(scenario, scenario.correctOptionId), { historyId: 'day1-h1', timestamp: day1.toISOString(), mode: 'daily' });
    const xpAfterDay1 = progressState.totalXp;
    const historyLengthAfterDay1 = progressState.recentTrainingHistory.length;

    progressState = applyTrainingResult(progressState, scenario, evaluateDecision(scenario, scenario.correctOptionId), { historyId: 'day2-h1', timestamp: day2.toISOString(), mode: 'daily' });

    expect(progressState.daily.todayCompletedDecisions).toBe(1);
    expect(progressState.totalXp).toBe(xpAfterDay1 + scenario.xpReward);
    expect(progressState.recentTrainingHistory.length).toBe(historyLengthAfterDay1 + 1);
  });

  it('records extra-practice XP, skills, and history without touching the daily goal or streak', () => {
    const now = new Date(2026, 8, 10, 9, 0);
    const completedDaily = { ...createDefaultDailyTrainingState(now), todayCompletedDecisions: 3, dailyGoalCompleted: true, dailyTrainingStreak: 1, bestDailyTrainingStreak: 1 };
    const initial = { ...mockProgress, daily: completedDaily };

    const updated = applyTrainingResult(initial, scenario, evaluateDecision(scenario, scenario.correctOptionId), { historyId: 'practice-h1', timestamp: now.toISOString(), mode: 'practice' });

    expect(updated.totalXp).toBe(initial.totalXp + scenario.xpReward);
    expect(updated.correctDecisions).toBe(initial.correctDecisions + 1);
    expect(updated.skillScores.profitTaking).toBe(initial.skillScores.profitTaking + 2);
    expect(updated.recentTrainingHistory[0]).toMatchObject({ id: 'practice-h1', correct: true });
    expect(updated.daily.todayCompletedDecisions).toBe(3);
    expect(updated.daily.dailyTrainingStreak).toBe(1);
    expect(updated.daily.dailyGoalCompleted).toBe(true);
  });
});