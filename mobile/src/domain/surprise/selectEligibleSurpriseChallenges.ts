import { SurpriseChallenge, SurpriseChallengeProgress, SurpriseChallengeTrigger } from '@/types/surpriseChallenge';

export function selectEligibleSurpriseChallenges(
  challenges: SurpriseChallenge[],
  trigger: SurpriseChallengeTrigger,
  progress: SurpriseChallengeProgress,
): SurpriseChallenge[] {
  return challenges
    .filter((challenge) => challenge.trigger === trigger)
    .filter((challenge) => {
      if (!challenge.oneTimeOnly) return true;
      return !progress.completed[challenge.id];
    });
}
