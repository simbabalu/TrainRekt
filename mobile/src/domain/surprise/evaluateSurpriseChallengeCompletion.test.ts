import { describe, expect, it } from 'vitest';

import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import { evaluateSurpriseChallengeCompletion } from './evaluateSurpriseChallengeCompletion';

describe('evaluateSurpriseChallengeCompletion', () => {
  const challenge = surpriseChallengeCatalog[0];

  it('keeps direct REJECT as preferred with +300 XP and badge', () => {
    const evaluation = evaluateSurpriseChallengeCompletion(challenge, 'reject', 'reject');

    expect(evaluation.outcomeTier).toBe('preferred');
    expect(evaluation.xpAwarded).toBe(300);
    expect(evaluation.badgeEarned).toBe(true);
  });

  it('keeps INSPECT then REJECT as acceptable with +250 XP and badge', () => {
    const evaluation = evaluateSurpriseChallengeCompletion(challenge, 'inspect', 'reject');

    expect(evaluation.outcomeTier).toBe('acceptable');
    expect(evaluation.xpAwarded).toBe(250);
    expect(evaluation.badgeEarned).toBe(true);
  });

  it('keeps SIGN as failed with +50 XP and no badge', () => {
    const evaluation = evaluateSurpriseChallengeCompletion(challenge, 'sign', 'sign');

    expect(evaluation.outcomeTier).toBe('failed');
    expect(evaluation.xpAwarded).toBe(50);
    expect(evaluation.badgeEarned).toBe(false);
  });
});
