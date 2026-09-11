import { TrainingProgress } from '@/types/progress';
import { SurpriseChallengeCompletionInput } from '@/types/surpriseChallenge';

export function applySurpriseChallengeCompletion(
  progress: TrainingProgress,
  input: SurpriseChallengeCompletionInput,
): TrainingProgress {
  const existingCompletion = progress.surpriseChallenges.completed[input.challenge.id];
  if (existingCompletion) return progress;

  const nextCompleted = {
    ...progress.surpriseChallenges.completed,
    [input.challenge.id]: {
      challengeVersion: input.challenge.version,
      completedAt: input.completedAt,
      firstDecision: input.firstDecision,
      finalDecision: input.finalDecision,
      xpAwarded: input.xpAwarded,
      badgeEarned: input.badgeEarned,
    },
  };

  const nextBadges = input.badgeEarned && input.challenge.badge
    ? {
      ...progress.badges.earned,
      [input.challenge.badge.id]: progress.badges.earned[input.challenge.badge.id] ?? {
        earnedAt: input.completedAt,
        sourceChallengeId: input.challenge.id,
        sourceChallengeVersion: input.challenge.version,
      },
    }
    : progress.badges.earned;

  return {
    ...progress,
    totalXp: progress.totalXp + input.xpAwarded,
    surpriseChallenges: { completed: nextCompleted },
    badges: { earned: nextBadges },
  };
}
