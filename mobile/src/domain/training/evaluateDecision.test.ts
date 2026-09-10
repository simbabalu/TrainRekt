import { describe, expect, it } from 'vitest';

import { scenarioCatalog } from '@/data/scenarioCatalog';
import { evaluateDecision } from './evaluateDecision';

const scenario = scenarioCatalog[0];

describe('evaluateDecision', () => {
  it('rewards the correct decision with the scenario reward', () => {
    const result = evaluateDecision(scenario, scenario.correctOptionId);

    expect(result).toEqual({
      isCorrect: true,
      xpEarned: 120,
      title: 'Good decision',
      explanation: scenario.explanation,
    });
  });

  it('returns the risky result and reduced XP for an incorrect decision', () => {
    const result = evaluateDecision(scenario, 'hold');

    expect(result.isCorrect).toBe(false);
    expect(result.xpEarned).toBe(30);
    expect(result.title).toBe('Risky decision');
    expect(result.explanation).toContain('overheating');
  });

  it('treats an unexpected runtime decision as incorrect', () => {
    const unexpectedDecision = 'unexpected-decision' as never;
    const result = evaluateDecision(scenario, unexpectedDecision);

    expect(result.isCorrect).toBe(false);
    expect(result.xpEarned).toBe(30);
  });
});