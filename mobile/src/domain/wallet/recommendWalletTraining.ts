import { getWalletLessonExerciseIds } from '@/data/walletLessonCatalog';
import type { WalletSafetySignalKind, WalletTokenAccountInspection } from '@/types/walletInspection';
import type { WalletTrainingPriority, WalletTrainingRecommendation, WalletTrainingTopic } from '@/types/walletTraining';
import { deriveWalletSafetySignals } from './deriveWalletSafetySignals';

interface TopicDefinition {
  topic: WalletTrainingTopic;
  priority: WalletTrainingPriority;
  reason: string;
}

const signalTopicDefinitions: Record<WalletSafetySignalKind, TopicDefinition> = {
  'frozen-account': {
    topic: 'token-account-state',
    priority: 'high',
    reason: 'Learn what frozen token-account state means and why context matters before conclusions.',
  },
  'delegated-account': {
    topic: 'delegated-authority',
    priority: 'high',
    reason: 'Learn how delegated authority works and how to review whether permission scope is expected.',
  },
  'token-2022-account': {
    topic: 'token-2022',
    priority: 'medium',
    reason: 'Understand Token-2022 capabilities and why program version alone is not a warning.',
  },
  'empty-token-account': {
    topic: 'empty-token-account',
    priority: 'low',
    reason: 'Learn why zero-balance token accounts can remain on-chain without implying danger.',
  },
};

const priorityRank: Record<WalletTrainingPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function getWalletTrainingTopicLabel(topic: WalletTrainingTopic): string {
  if (topic === 'token-account-state') return 'TOKEN ACCOUNT STATES';
  if (topic === 'delegated-authority') return 'DELEGATED AUTHORITY';
  if (topic === 'token-2022') return 'TOKEN-2022';
  return 'EMPTY TOKEN ACCOUNTS';
}

export function recommendWalletTraining(accounts: WalletTokenAccountInspection[]): WalletTrainingRecommendation[] {
  const groupedSignals = new Map<WalletSafetySignalKind, Set<string>>();
  const signals = deriveWalletSafetySignals(accounts);

  for (const signal of signals) {
    const existing = groupedSignals.get(signal.kind) ?? new Set<string>();
    existing.add(signal.tokenAccountAddress);
    groupedSignals.set(signal.kind, existing);
  }

  const recommendations: WalletTrainingRecommendation[] = [];
  for (const [signalKind, accountSet] of groupedSignals.entries()) {
    const definition = signalTopicDefinitions[signalKind];
    if (!definition) continue;
    recommendations.push({
      topic: definition.topic,
      priority: definition.priority,
      reason: definition.reason,
      sourceSignalType: signalKind,
      observedAccountCount: accountSet.size,
      recommendedExerciseIds: getWalletLessonExerciseIds(definition.topic),
    });
  }

  return recommendations.sort((first, second) => {
    const priorityDelta = priorityRank[first.priority] - priorityRank[second.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const countDelta = second.observedAccountCount - first.observedAccountCount;
    if (countDelta !== 0) return countDelta;
    return first.topic.localeCompare(second.topic);
  });
}
