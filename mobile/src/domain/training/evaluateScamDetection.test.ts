import { describe, expect, it } from 'vitest';

import { scamDetectionCatalog } from '@/data/scamDetectionCatalog';
import { evaluateScamDetection } from './evaluateScamDetection';

describe('evaluateScamDetection', () => {
  it('returns correct result payload with scamDetection analysis when answer is correct', () => {
    const exercise = scamDetectionCatalog.find((candidate) => candidate.id === 'scam-fake-airdrop-claim');
    if (!exercise) throw new Error('Expected scam detection exercise.');

    const result = evaluateScamDetection(exercise, exercise.expectedDecision);

    expect(result.isCorrect).toBe(true);
    expect(result.xpEarned).toBe(exercise.xpReward);
    expect(result.title).toBe('Good decision');
    expect(result.scamDetection).toBeDefined();
    expect(result.scamDetection?.sourceType).toBe(exercise.scenario.sourceType);
    expect(result.scamDetection?.neutralFacts).toEqual(exercise.scenario.neutralFacts);
  });

  it('marks safe classification as risky when the expected decision is suspicious or scam', () => {
    const exercise = scamDetectionCatalog.find((candidate) => candidate.expectedDecision !== 'safe');
    if (!exercise) throw new Error('Expected non-safe scam detection exercise.');

    const result = evaluateScamDetection(exercise, 'safe');

    expect(result.isCorrect).toBe(false);
    expect(result.xpEarned).toBe(30);
    expect(result.title).toBe('Risky decision');
  });

  it('marks suspicious as incomplete when expected decision differs', () => {
    const exercise = scamDetectionCatalog.find((candidate) => candidate.expectedDecision === 'scam');
    if (!exercise) throw new Error('Expected scam-labeled exercise.');

    const result = evaluateScamDetection(exercise, 'suspicious');

    expect(result.isCorrect).toBe(false);
    expect(result.title).toBe('Incomplete decision');
  });
});
