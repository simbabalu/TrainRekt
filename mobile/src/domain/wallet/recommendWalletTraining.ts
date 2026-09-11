import { findWalletLessonExercise, getWalletLessonExerciseIds } from '@/data/walletLessonCatalog';
import type { WalletMintInspection, WalletSafetySignalKind, WalletTokenAccountInspection } from '@/types/walletInspection';
import type { WalletTrainingPriority, WalletTrainingRecommendation, WalletTrainingTopic } from '@/types/walletTraining';
import { deriveWalletSafetySignalsWithMints } from './deriveWalletSafetySignals';

interface TopicDefinition {
  topic: WalletTrainingTopic;
  priority: WalletTrainingPriority;
  reason: string;
}

const signalTopicDefinitions: Partial<Record<WalletSafetySignalKind, TopicDefinition>> = {
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
  'token-2022-transfer-fee-config': {
    topic: 'token-2022',
    priority: 'medium',
    reason: 'Understand transfer-fee capabilities under Token-2022 and how to review them objectively.',
  },
  'token-2022-transfer-hook': {
    topic: 'token-2022',
    priority: 'high',
    reason: 'Learn how transfer hooks add program-controlled transfer logic without assuming malicious intent.',
  },
  'token-2022-non-transferable': {
    topic: 'token-2022',
    priority: 'medium',
    reason: 'Understand non-transferable token behavior and why transfer restrictions can be intentional.',
  },
  'token-2022-default-account-state': {
    topic: 'token-account-state',
    priority: 'high',
    reason: 'Learn how default account state settings influence token-account behavior over time.',
  },
  'token-2022-interest-bearing-config': {
    topic: 'token-2022',
    priority: 'medium',
    reason: 'Understand interest-bearing token configuration as a capability signal requiring context.',
  },
  'token-2022-metadata-pointer': {
    topic: 'token-2022',
    priority: 'low',
    reason: 'Learn what metadata pointer configuration means and why it is informational by itself.',
  },
  'token-2022-group-pointer': {
    topic: 'token-2022',
    priority: 'low',
    reason: 'Learn how Token-2022 group pointers encode relationships without implying risk by default.',
  },
  'token-2022-group-member-pointer': {
    topic: 'token-2022',
    priority: 'low',
    reason: 'Learn how Token-2022 group member pointers add structure and should be interpreted with context.',
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

export function recommendWalletTraining(
  accounts: WalletTokenAccountInspection[],
  mintInspections: WalletMintInspection[] = [],
): WalletTrainingRecommendation[] {
  const mintByAddress = new Map(mintInspections.map((mintInspection) => [mintInspection.mintAddress, mintInspection]));
  const topicAggregation = new Map<WalletTrainingTopic, {
    topic: WalletTrainingTopic;
    priority: WalletTrainingPriority;
    reason: string;
    sourceSignalType: WalletSafetySignalKind;
    observedEntities: Set<string>;
  }>();
  const signals = deriveWalletSafetySignalsWithMints(accounts, mintInspections);

  for (const signal of signals) {
    const mintInspection = mintByAddress.get(signal.mintAddress);
    const isMintLevelSignal = signal.kind === 'mint-authority-active'
      || signal.kind === 'freeze-authority-active'
      || signal.kind.startsWith('token-2022-');
    const definition = signalTopicDefinitions[signal.kind];
    if (!definition) continue;

    const entityKey = isMintLevelSignal && mintInspection
      ? `mint:${mintInspection.mintAddress}`
      : `account:${signal.tokenAccountAddress}`;

    const existingTopic = topicAggregation.get(definition.topic);
    if (!existingTopic) {
      topicAggregation.set(definition.topic, {
        topic: definition.topic,
        priority: definition.priority,
        reason: definition.reason,
        sourceSignalType: signal.kind,
        observedEntities: new Set([entityKey]),
      });
      continue;
    }

    existingTopic.observedEntities.add(entityKey);

    const existingPriority = priorityRank[existingTopic.priority];
    const nextPriority = priorityRank[definition.priority];
    if (nextPriority < existingPriority) {
      existingTopic.priority = definition.priority;
      existingTopic.reason = definition.reason;
      existingTopic.sourceSignalType = signal.kind;
    }
  }

  const recommendations: WalletTrainingRecommendation[] = [];
  for (const aggregate of topicAggregation.values()) {
    const recommendedExerciseIds = getWalletLessonExerciseIds(aggregate.topic)
      .filter((exerciseId) => Boolean(findWalletLessonExercise(exerciseId)));
    if (recommendedExerciseIds.length === 0) continue;

    recommendations.push({
      topic: aggregate.topic,
      priority: aggregate.priority,
      reason: aggregate.reason,
      sourceSignalType: aggregate.sourceSignalType,
      observedAccountCount: aggregate.observedEntities.size,
      recommendedExerciseIds,
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
