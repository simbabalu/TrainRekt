import { describe, expect, it } from 'vitest';

import type { WalletTrainingRecommendation } from '@/types/walletTraining';

import {
  getNextWalletTrainingRecommendation,
  sortWalletTrainingRecommendations,
  type WalletTrainingRecommendationWithStatus,
} from './sortWalletTrainingRecommendations';

function entry(topic: WalletTrainingRecommendation['topic'], status: WalletTrainingRecommendationWithStatus['status'], priority: WalletTrainingRecommendation['priority'] = 'medium'): WalletTrainingRecommendationWithStatus {
  return {
    recommendation: {
      topic,
      priority,
      reason: `Reason for ${topic}`,
      sourceSignalType: 'token-2022-account',
      observedAccountCount: 1,
      recommendedExerciseIds: [`exercise-${topic}`],
    },
    status,
  };
}

describe('wallet training learning path', () => {
  it('orders failed, then not-started, then passed recommendations', () => {
    const ordered = sortWalletTrainingRecommendations([
      entry('token-2022', 'passed'),
      entry('delegated-authority', 'failed'),
      entry('empty-token-account', 'not-started'),
    ]);

    expect(ordered.map(({ recommendation }) => recommendation.topic)).toEqual([
      'delegated-authority',
      'empty-token-account',
      'token-2022',
    ]);
  });

  it('preserves existing recommendation order within the same status', () => {
    const ordered = sortWalletTrainingRecommendations([
      entry('token-2022', 'not-started', 'high'),
      entry('delegated-authority', 'not-started', 'high'),
      entry('empty-token-account', 'passed', 'low'),
    ]);

    expect(ordered.map(({ recommendation }) => recommendation.topic)).toEqual([
      'token-2022',
      'delegated-authority',
      'empty-token-account',
    ]);
  });

  it('selects the first failed recommendation as next', () => {
    const recommendations = [
      entry('token-2022', 'failed'),
      entry('delegated-authority', 'failed'),
      entry('empty-token-account', 'not-started'),
    ];

    expect(getNextWalletTrainingRecommendation(recommendations)?.recommendation.topic).toBe('token-2022');
  });

  it('selects the first not-started recommendation when there are no failures', () => {
    const recommendations = [
      entry('token-2022', 'passed'),
      entry('delegated-authority', 'not-started'),
      entry('empty-token-account', 'not-started'),
    ];

    expect(getNextWalletTrainingRecommendation(recommendations)?.recommendation.topic).toBe('delegated-authority');
  });

  it('returns no next recommendation when all recommendations are passed', () => {
    const recommendations = [
      entry('token-2022', 'passed'),
      entry('delegated-authority', 'passed'),
    ];

    expect(getNextWalletTrainingRecommendation(recommendations)).toBeNull();
  });

  it('moves a failed lesson out of the featured next position after it passes', () => {
    const before = [entry('token-2022', 'failed'), entry('delegated-authority', 'not-started')];
    const after = [entry('token-2022', 'passed'), entry('delegated-authority', 'not-started')];

    expect(getNextWalletTrainingRecommendation(before)?.recommendation.topic).toBe('token-2022');
    expect(getNextWalletTrainingRecommendation(after)?.recommendation.topic).toBe('delegated-authority');
  });
});
