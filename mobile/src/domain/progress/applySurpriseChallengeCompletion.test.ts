import { describe, expect, it } from 'vitest';

import { mockProgress } from '@/data/mockProgress';
import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import { applySurpriseChallengeCompletion } from './applySurpriseChallengeCompletion';

describe('applySurpriseChallengeCompletion', () => {
  it('records completion, awards bonus XP, and awards badge once', () => {
    const challenge = surpriseChallengeCatalog[0];
    const updated = applySurpriseChallengeCompletion(mockProgress, {
      challenge,
      firstDecision: 'reject',
      finalDecision: 'reject',
      xpAwarded: 300,
      badgeEarned: true,
      completedAt: '2026-09-11T08:00:00.000Z',
    });

    expect(updated.totalXp).toBe(mockProgress.totalXp + 300);
    expect(updated.surpriseChallenges.completed[challenge.id]).toEqual({
      challengeVersion: challenge.version,
      completedAt: '2026-09-11T08:00:00.000Z',
      firstDecision: 'reject',
      finalDecision: 'reject',
      xpAwarded: 300,
      badgeEarned: true,
    });
    expect(updated.badges.earned['airdrop-survivor']).toEqual({
      earnedAt: '2026-09-11T08:00:00.000Z',
      sourceChallengeId: challenge.id,
      sourceChallengeVersion: challenge.version,
    });
  });

  it('is idempotent for already-completed challenge', () => {
    const challenge = surpriseChallengeCatalog[0];
    const first = applySurpriseChallengeCompletion(mockProgress, {
      challenge,
      firstDecision: 'inspect',
      finalDecision: 'reject',
      xpAwarded: 250,
      badgeEarned: true,
      completedAt: '2026-09-11T08:00:00.000Z',
    });

    const second = applySurpriseChallengeCompletion(first, {
      challenge,
      firstDecision: 'reject',
      finalDecision: 'reject',
      xpAwarded: 300,
      badgeEarned: true,
      completedAt: '2026-09-11T08:01:00.000Z',
    });

    expect(second).toBe(first);
  });
});
