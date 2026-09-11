import { describe, expect, it } from 'vitest';

import type { HistoryEntry, SkillScores } from '@/types/progress';

import { summarizeProgressSkills } from './summarizeProgressSkills';

function skillScores(overrides: Partial<SkillScores> = {}): SkillScores {
  return {
    riskManagement: 50,
    profitTaking: 50,
    fomoResistance: 50,
    positionSizing: 50,
    scamAwareness: 50,
    leverageRisk: 50,
    panicSelling: 50,
    marketInterpretation: 50,
    walletSafety: 50,
    ...overrides,
  };
}

function historyEntry(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: 'h-1',
    scenarioId: 'exercise-1',
    scenarioTitle: 'Exercise',
    correct: true,
    skill: 'profitTaking',
    timestamp: '2026-09-11T10:00:00.000Z',
    xpEarned: 120,
    exerciseType: 'decision',
    ...overrides,
  };
}

describe('summarizeProgressSkills', () => {
  it('marks skills with no score deviation and no history as untrained', () => {
    const summary = summarizeProgressSkills(skillScores(), []);

    expect(summary.trainedSkills).toHaveLength(0);
    expect(summary.untrainedSkills).toHaveLength(9);
    expect(summary.allSkills.every((entry) => entry.trained === false)).toBe(true);
  });

  it('marks skills as trained from history even when score equals neutral prior', () => {
    const summary = summarizeProgressSkills(skillScores(), [historyEntry({ skill: 'walletSafety' })]);

    const walletSafety = summary.allSkills.find((entry) => entry.skill === 'walletSafety');
    expect(walletSafety?.trained).toBe(true);
    expect(walletSafety?.score).toBe(50);
  });

  it('ranks strongest and needs-practice from trained skills with deterministic ties', () => {
    const summary = summarizeProgressSkills(
      skillScores({
        profitTaking: 52,
        riskManagement: 52,
        walletSafety: 49,
      }),
      [
        historyEntry({ id: 'h-1', skill: 'profitTaking' }),
        historyEntry({ id: 'h-2', skill: 'riskManagement' }),
        historyEntry({ id: 'h-3', skill: 'walletSafety' }),
      ],
    );

    expect(summary.strongestSkills.map((entry) => entry.skill)).toEqual(['riskManagement', 'profitTaking']);
    expect(summary.needsPracticeSkills.map((entry) => entry.skill)).toEqual(['walletSafety']);
  });

  it('does not duplicate a skill between strongest and needs-practice groups', () => {
    const summary = summarizeProgressSkills(
      skillScores({
        riskManagement: 70,
        profitTaking: 40,
      }),
      [historyEntry({ id: 'h-1', skill: 'riskManagement' }), historyEntry({ id: 'h-2', skill: 'profitTaking' })],
    );

    const strongest = new Set(summary.strongestSkills.map((entry) => entry.skill));
    const needsPractice = new Set(summary.needsPracticeSkills.map((entry) => entry.skill));
    const overlap = Array.from(strongest).filter((skill) => needsPractice.has(skill));

    expect(overlap).toEqual([]);
  });

  it('handles a single trained skill without forcing a needs-practice duplicate', () => {
    const summary = summarizeProgressSkills(
      skillScores({ walletSafety: 51 }),
      [historyEntry({ id: 'h-1', skill: 'walletSafety' })],
    );

    expect(summary.strongestSkills.map((entry) => entry.skill)).toEqual(['walletSafety']);
    expect(summary.needsPracticeSkills).toEqual([]);
  });
});
