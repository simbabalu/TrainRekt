import { findWalletLessonExercise, getWalletLessonExerciseIds } from '@/data/walletLessonCatalog';
import type { TokenAnalysisReport, TokenAnalysisTrainingCta } from '@/types/tokenAnalysis';
import type { WalletTrainingTopic } from '@/types/walletTraining';

interface TopicCandidate {
  topic: WalletTrainingTopic;
  priority: number;
}

function hasToken2022Finding(report: TokenAnalysisReport): boolean {
  if (report.inspection.program.programType.toLowerCase().includes('token-2022')) return true;
  return report.inspection.reviewSignals.some((signal) => signal.category.toLowerCase().includes('token-2022'));
}

function hasAuthorityFinding(report: TokenAnalysisReport): boolean {
  return !report.inspection.authorities.mintAuthorityRevoked || !report.inspection.authorities.freezeAuthorityRevoked;
}

function hasConcentrationFinding(report: TokenAnalysisReport): boolean {
  if (report.inspection.holderConcentration.topHolderPercentage != null) return true;
  if (report.inspection.largestTokenAccounts.length > 0) return true;
  const unclassified = report.inspection.holderConcentration.unclassifiedTokenAccountConcentration;
  return Boolean(unclassified?.largestUnknownTokenAccountPercentage != null || unclassified?.top5UnknownTokenAccountsPercentage != null);
}

function hasIdentityClassificationFinding(report: TokenAnalysisReport): boolean {
  return Boolean(report.provenance?.identityClassification);
}

function pickTopic(candidates: TopicCandidate[]): WalletTrainingTopic | null {
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority);
  return sorted[0]?.topic ?? null;
}

function toTrainingCta(topic: WalletTrainingTopic | null): TokenAnalysisTrainingCta | null {
  if (!topic) return null;
  const firstExerciseId = getWalletLessonExerciseIds(topic)
    .find((exerciseId) => Boolean(findWalletLessonExercise(exerciseId)));
  if (!firstExerciseId) return null;
  return {
    topic,
    exerciseId: firstExerciseId,
  };
}

export function recommendTokenAnalysisTraining(report: TokenAnalysisReport): TokenAnalysisTrainingCta | null {
  const candidates: TopicCandidate[] = [];

  if (hasToken2022Finding(report)) {
    candidates.push({ topic: 'token-2022', priority: 0 });
  }

  if (hasAuthorityFinding(report)) {
    candidates.push({ topic: 'token-account-state', priority: 1 });
  }

  if (hasConcentrationFinding(report)) {
    candidates.push({ topic: 'token-account-state', priority: 2 });
  }

  if (hasIdentityClassificationFinding(report)) {
    candidates.push({ topic: 'token-account-state', priority: 3 });
  }

  return toTrainingCta(pickTopic(candidates));
}
