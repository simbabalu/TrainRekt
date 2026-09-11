export type SurpriseChallengeTrigger =
  | 'wallet-connected'
  | 'app-start'
  | 'training-completed'
  | 'progress-milestone';

export type SurpriseChallengeKind =
  | 'fake-airdrop'
  | 'fake-security-warning'
  | 'fake-support'
  | 'fake-reward-claim';

export type SurpriseChallengeDecision = 'sign' | 'inspect' | 'reject';

export type SurpriseChallengeFinalDecision = Exclude<SurpriseChallengeDecision, 'inspect'>;

export type SurpriseChallengeOutcomeTier = 'preferred' | 'acceptable' | 'failed';

export type SurpriseChallengeOutcomeRating = 'excellent' | 'good' | 'risky';

export interface SurpriseChallengeOutcomePresentation {
  headline: string;
  summary: string;
}

export interface SurpriseChallengeDelay {
  minMs: number;
  maxMs: number;
}

export interface SurpriseChallengePresentation {
  title: string;
  message: string;
  sourceLabel?: string;
  domain?: string;
  rewardLabel?: string;
  countdownSeconds?: number;
  facts?: string[];
}

export interface SurpriseChallengeOutcome {
  preferredDecision: SurpriseChallengeFinalDecision;
  acceptableDecisions?: SurpriseChallengeFinalDecision[];
  presentation: Record<SurpriseChallengeOutcomeTier, SurpriseChallengeOutcomePresentation>;
  xp: {
    preferred: number;
    acceptable: number;
    failed: number;
  };
}

export interface SurpriseChallengeBadge {
  id: string;
  name: string;
  description: string;
  onChainMint?: string;
}

export interface SurpriseChallenge {
  id: string;
  version: number;
  kind: SurpriseChallengeKind;
  trigger: SurpriseChallengeTrigger;
  oneTimeOnly: boolean;
  delay?: SurpriseChallengeDelay;
  presentation: SurpriseChallengePresentation;
  decisions: SurpriseChallengeDecision[];
  outcome: SurpriseChallengeOutcome;
  explanation: string;
  manipulationTechniques: string[];
  learningPoints: string[];
  ruleToRemember: string;
  badge?: SurpriseChallengeBadge;
}

export interface SurpriseChallengeCompletionRecord {
  challengeVersion: number;
  completedAt: string;
  firstDecision: SurpriseChallengeDecision;
  finalDecision: SurpriseChallengeFinalDecision;
  xpAwarded: number;
  badgeEarned: boolean;
}

export interface SurpriseChallengeProgress {
  completed: Record<string, SurpriseChallengeCompletionRecord>;
}

export interface EarnedBadgeRecord {
  earnedAt: string;
  sourceChallengeId: string;
  sourceChallengeVersion: number;
}

export interface BadgeProgress {
  earned: Record<string, EarnedBadgeRecord>;
}

export interface SurpriseChallengeCompletionInput {
  challenge: SurpriseChallenge;
  firstDecision: SurpriseChallengeDecision;
  finalDecision: SurpriseChallengeFinalDecision;
  xpAwarded: number;
  badgeEarned: boolean;
  completedAt: string;
}
