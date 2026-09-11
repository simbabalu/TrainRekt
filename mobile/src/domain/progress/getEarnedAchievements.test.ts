import { describe, expect, it } from 'vitest';

import { getEarnedAchievements } from './getEarnedAchievements';

describe('getEarnedAchievements', () => {
  it('returns empty when no badges are earned', () => {
    expect(getEarnedAchievements({ earned: {} })).toEqual([]);
  });

  it('maps known earned badge ids to catalog metadata', () => {
    const achievements = getEarnedAchievements({
      earned: {
        'airdrop-survivor': {
          earnedAt: '2026-09-11T10:00:00.000Z',
          sourceChallengeId: 'surprise-airdrop-001',
          sourceChallengeVersion: 1,
        },
      },
    });

    expect(achievements).toEqual([
      {
        id: 'airdrop-survivor',
        title: 'Airdrop Survivor',
        description: 'Completed the fake airdrop surprise challenge with a safe final rejection.',
        earnedAt: '2026-09-11T10:00:00.000Z',
      },
    ]);
  });

  it('ignores unknown badge ids', () => {
    const achievements = getEarnedAchievements({
      earned: {
        'unknown-badge': {
          earnedAt: '2026-09-11T10:00:00.000Z',
          sourceChallengeId: 'unknown',
          sourceChallengeVersion: 1,
        },
      },
    });

    expect(achievements).toEqual([]);
  });
});
