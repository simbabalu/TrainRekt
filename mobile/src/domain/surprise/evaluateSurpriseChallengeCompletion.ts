import {
  SurpriseChallenge,
  SurpriseChallengeDecision,
  SurpriseChallengeFinalDecision,
  SurpriseChallengeOutcomeRating,
  SurpriseChallengeOutcomeTier,
} from '@/types/surpriseChallenge';

export interface SurpriseChallengeEvaluation {
  xpAwarded: number;
  badgeEarned: boolean;
  outcomeTier: SurpriseChallengeOutcomeTier;
  rating: SurpriseChallengeOutcomeRating;
  headline: string;
  summary: string;
}

const ratingByTier: Record<SurpriseChallengeOutcomeTier, SurpriseChallengeOutcomeRating> = {
  preferred: 'excellent',
  acceptable: 'good',
  failed: 'risky',
};

export function evaluateSurpriseChallengeCompletion(
  challenge: SurpriseChallenge,
  firstDecision: SurpriseChallengeDecision,
  finalDecision: SurpriseChallengeFinalDecision,
): SurpriseChallengeEvaluation {
  const acceptableDecisions = challenge.outcome.acceptableDecisions ?? [];
  const isPreferred = finalDecision === challenge.outcome.preferredDecision && firstDecision === finalDecision;
  const isAcceptable = !isPreferred && acceptableDecisions.includes(finalDecision);
  const outcomeTier: SurpriseChallengeOutcomeTier = isPreferred ? 'preferred' : isAcceptable ? 'acceptable' : 'failed';
  const presentation = challenge.outcome.presentation[outcomeTier];

  return {
    xpAwarded: outcomeTier === 'preferred' ? challenge.outcome.xp.preferred : outcomeTier === 'acceptable' ? challenge.outcome.xp.acceptable : challenge.outcome.xp.failed,
    badgeEarned: finalDecision === 'reject' && outcomeTier !== 'failed' && Boolean(challenge.badge),
    outcomeTier,
    rating: ratingByTier[outcomeTier],
    headline: presentation.headline,
    summary: presentation.summary,
  };
}
