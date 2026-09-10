import { describe, expect, it } from 'vitest';

import { mockProgress } from '@/data/mockProgress';
import { mockScenarios } from '@/data/mockScenarios';
import { applyTrainingResult } from './applyTrainingResult';
import { createProgressSnapshot, calculateLevel, calculateWinRate } from './calculateLevel';
import { evaluateDecision } from '@/domain/training/evaluateDecision';

const scenario = mockScenarios[0];
const metadata = { historyId: 'test-history', timestamp: '2026-09-10T12:00:00.000Z' };

describe('progress calculations', () => {
  it('calculates level boundaries from total XP', () => {
    expect(calculateLevel(0).level).toBe(1);
    expect(calculateLevel(999)).toMatchObject({ level: 1, xpIntoCurrentLevel: 999 });
    expect(calculateLevel(1000)).toMatchObject({ level: 2, xpIntoCurrentLevel: 0 });
    expect(calculateLevel(1999)).toMatchObject({ level: 2, xpIntoCurrentLevel: 999 });
    expect(calculateLevel(2000)).toMatchObject({ level: 3, xpIntoCurrentLevel: 0 });
  });

  it('calculates win rate from correct and wrong decisions', () => {
    expect(calculateWinRate(0, 0)).toBe(0);
    expect(calculateWinRate(34, 25)).toBe(58);
  });

  it('applies a correct result, streak, best streak, skill score, and history entry', () => {
    const result = evaluateDecision(scenario, scenario.correctDecision);
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
    const result = evaluateDecision(scenario, scenario.correctDecision);
    const high = applyTrainingResult({ ...mockProgress, skillScores: { ...mockProgress.skillScores, profitTaking: 100 } }, scenario, result, metadata);
    const wrongResult = evaluateDecision(scenario, 'hold');
    const low = applyTrainingResult({ ...mockProgress, skillScores: { ...mockProgress.skillScores, profitTaking: 0 } }, scenario, wrongResult, metadata);

    expect(high.skillScores.profitTaking).toBe(100);
    expect(low.skillScores.profitTaking).toBe(0);
  });

  it('keeps history newest-first and limits it to ten entries', () => {
    const history = Array.from({ length: 10 }, (_, index) => ({ ...mockProgress.recentTrainingHistory[0], id: `existing-${index}` }));
    const updated = applyTrainingResult({ ...mockProgress, recentTrainingHistory: history }, scenario, evaluateDecision(scenario, scenario.correctDecision), metadata);

    expect(updated.recentTrainingHistory).toHaveLength(10);
    expect(updated.recentTrainingHistory[0].id).toBe(metadata.historyId);
    expect(updated.recentTrainingHistory.some((entry) => entry.id === 'existing-0')).toBe(true);
    expect(updated.recentTrainingHistory.some((entry) => entry.id === 'existing-9')).toBe(false);
  });

  it('derives the complete progress snapshot without storing duplicate calculations', () => {
    const snapshot = createProgressSnapshot({ ...mockProgress, totalXp: 2742 });

    expect(snapshot).toMatchObject({ level: 3, xpIntoCurrentLevel: 742, xpRequiredForNextLevel: 1000, winRate: 58 });
  });
});