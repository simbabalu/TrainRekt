import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import type { BadgeProgress } from '@/types/surpriseChallenge';

export interface EarnedAchievement {
  id: string;
  title: string;
  description: string;
  earnedAt: string;
}

export function getEarnedAchievements(badges: BadgeProgress): EarnedAchievement[] {
  const badgeMetadata = new Map(
    surpriseChallengeCatalog
      .filter((challenge) => Boolean(challenge.badge))
      .map((challenge) => [challenge.badge!.id, challenge.badge!]),
  );

  return Object.entries(badges.earned)
    .map(([badgeId, earnedRecord]) => {
      const badge = badgeMetadata.get(badgeId);
      if (!badge) return null;
      return {
        id: badgeId,
        title: badge.name,
        description: badge.description,
        earnedAt: earnedRecord.earnedAt,
      } satisfies EarnedAchievement;
    })
    .filter((achievement): achievement is EarnedAchievement => Boolean(achievement))
    .sort((first, second) => {
      const timeComparison = second.earnedAt.localeCompare(first.earnedAt);
      if (timeComparison !== 0) return timeComparison;
      return first.title.localeCompare(second.title);
    });
}
