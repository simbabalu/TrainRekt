import { describe, expect, it } from 'vitest';

import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import { SurpriseChallenge } from '@/types/surpriseChallenge';
import { selectEligibleSurpriseChallenges } from './selectEligibleSurpriseChallenges';

describe('selectEligibleSurpriseChallenges', () => {
  it('returns wallet-connected challenge when incomplete', () => {
    const eligible = selectEligibleSurpriseChallenges(
      surpriseChallengeCatalog,
      'wallet-connected',
      { completed: {} },
    );

    expect(eligible.map((item) => item.id)).toEqual(['surprise-airdrop-001']);
  });

  it('excludes completed one-time challenge and keeps future ids eligible', () => {
    const futureChallenge: SurpriseChallenge = {
      ...surpriseChallengeCatalog[0],
      id: 'surprise-support-dm-001',
      kind: 'fake-support',
      trigger: 'wallet-connected',
      presentation: {
        ...surpriseChallengeCatalog[0].presentation,
        title: 'Account review required',
      },
      badge: undefined,
    };

    const eligible = selectEligibleSurpriseChallenges(
      [...surpriseChallengeCatalog, futureChallenge],
      'wallet-connected',
      {
        completed: {
          'surprise-airdrop-001': {
            challengeVersion: 1,
            completedAt: '2026-01-01T00:00:00.000Z',
            firstDecision: 'reject',
            finalDecision: 'reject',
            xpAwarded: 300,
            badgeEarned: true,
          },
        },
      },
    );

    expect(eligible.map((item) => item.id)).toEqual(['surprise-support-dm-001']);
  });
});
