import { describe, expect, it } from 'vitest';

import { walletLessonCatalog } from '@/data/walletLessonCatalog';
import type { WalletMintInspection, WalletTokenAccountInspection } from '@/types/walletInspection';
import { recommendWalletTraining } from './recommendWalletTraining';

function account(overrides: Partial<WalletTokenAccountInspection>): WalletTokenAccountInspection {
  return {
    tokenAccountAddress: 'token-account-1',
    mintAddress: 'mint-1',
    program: 'spl-token',
    rawAmount: '1',
    decimals: 6,
    uiAmount: 0.000001,
    state: 'initialized',
    delegateAddress: null,
    delegatedAmountRaw: null,
    closeAuthorityAddress: null,
    ...overrides,
  };
}

function mintInspection(overrides: Partial<WalletMintInspection>): WalletMintInspection {
  return {
    mintAddress: 'mint-1',
    program: 'spl-token',
    decimals: 6,
    supplyRaw: '100',
    mintAuthorityState: 'revoked',
    mintAuthorityAddress: null,
    freezeAuthorityState: 'revoked',
    freezeAuthorityAddress: null,
    token2022Extensions: [],
    defaultAccountState: null,
    unavailableReason: null,
    ...overrides,
  };
}

describe('recommendWalletTraining', () => {
  it('maps frozen account signals to token-account-state recommendations', () => {
    const recommendations = recommendWalletTraining([
      account({ tokenAccountAddress: 'frozen-1', state: 'frozen' }),
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].topic).toBe('token-account-state');
    expect(recommendations[0].priority).toBe('high');
    expect(recommendations[0].sourceSignalType).toBe('frozen-account');
    expect(recommendations[0].observedAccountCount).toBe(1);
  });

  it('maps delegated account signals to delegated-authority recommendations', () => {
    const recommendations = recommendWalletTraining([
      account({ tokenAccountAddress: 'delegated-1', delegateAddress: 'delegate-1' }),
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].topic).toBe('delegated-authority');
    expect(recommendations[0].priority).toBe('high');
    expect(recommendations[0].sourceSignalType).toBe('delegated-account');
  });

  it('maps token-2022 signals to token-2022 recommendations', () => {
    const recommendations = recommendWalletTraining([
      account({ tokenAccountAddress: 'token-2022-1', program: 'token-2022' }),
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].topic).toBe('token-2022');
    expect(recommendations[0].priority).toBe('medium');
    expect(recommendations[0].sourceSignalType).toBe('token-2022-account');
  });

  it('maps empty token account signals to empty-token-account recommendations', () => {
    const recommendations = recommendWalletTraining([
      account({ tokenAccountAddress: 'empty-1', rawAmount: '0', uiAmount: 0 }),
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].topic).toBe('empty-token-account');
    expect(recommendations[0].priority).toBe('low');
    expect(recommendations[0].sourceSignalType).toBe('empty-token-account');
  });

  it('deduplicates repeated signal types across multiple accounts into one recommendation', () => {
    const recommendations = recommendWalletTraining([
      account({ tokenAccountAddress: 'frozen-1', state: 'frozen' }),
      account({ tokenAccountAddress: 'frozen-2', state: 'frozen' }),
      account({ tokenAccountAddress: 'frozen-3', state: 'frozen' }),
    ]);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].topic).toBe('token-account-state');
    expect(recommendations[0].observedAccountCount).toBe(3);
  });

  it('returns at most one recommendation per topic', () => {
    const mintInspections = [
      mintInspection({ mintAddress: 'mint-topic-1', program: 'token-2022', token2022Extensions: ['transfer-fee-config'] }),
      mintInspection({ mintAddress: 'mint-topic-2', program: 'token-2022', token2022Extensions: ['transfer-hook'] }),
    ];
    const [firstMint, secondMint] = mintInspections;
    const firstAccount: WalletTokenAccountInspection = {
      ...account({}),
      tokenAccountAddress: 'acct-topic-1',
      mintAddress: firstMint.mintAddress,
      program: 'token-2022',
    };
    const secondAccount: WalletTokenAccountInspection = {
      ...account({}),
      tokenAccountAddress: 'acct-topic-2',
      mintAddress: secondMint.mintAddress,
      program: 'token-2022',
    };

    const recommendations = recommendWalletTraining([firstAccount, secondAccount], mintInspections);
    const topicCounts = recommendations.reduce<Map<string, number>>((acc, recommendation) => {
      acc.set(recommendation.topic, (acc.get(recommendation.topic) ?? 0) + 1);
      return acc;
    }, new Map());

    for (const [, count] of topicCounts) {
      expect(count).toBe(1);
    }
  });

  it('only emits recommendations that have at least one valid lesson exercise id', () => {
    const recommendations = recommendWalletTraining([account({ state: 'frozen', tokenAccountAddress: 'frozen-catalog-1' })]);
    const allExerciseIds = new Set(walletLessonCatalog.map((exercise) => exercise.id));

    for (const recommendation of recommendations) {
      expect(recommendation.recommendedExerciseIds.length).toBeGreaterThan(0);
      for (const exerciseId of recommendation.recommendedExerciseIds) {
        expect(allExerciseIds.has(exerciseId)).toBe(true);
      }
    }
  });

  it('sorts mixed signals by educational priority', () => {
    const recommendations = recommendWalletTraining([
      account({ tokenAccountAddress: 'empty-1', rawAmount: '0', uiAmount: 0 }),
      account({ tokenAccountAddress: 'token-2022-1', program: 'token-2022' }),
      account({ tokenAccountAddress: 'frozen-1', state: 'frozen' }),
      account({ tokenAccountAddress: 'delegated-1', delegateAddress: 'delegate-1' }),
    ]);

    expect(recommendations.map((recommendation) => recommendation.priority)).toEqual([
      'high',
      'high',
      'medium',
      'low',
    ]);
  });

  it('returns an empty list when no known wallet signals exist', () => {
    const recommendations = recommendWalletTraining([
      account({ tokenAccountAddress: 'normal-1' }),
    ]);

    expect(recommendations).toEqual([]);
  });

  it('maps selected mint Token-2022 extension signals to existing topics', () => {
    const recommendations = recommendWalletTraining(
      [account({ tokenAccountAddress: 'mint-aware-1', mintAddress: 'mint-1', program: 'token-2022' })],
      [mintInspection({
        mintAddress: 'mint-1',
        program: 'token-2022',
        token2022Extensions: ['permanent-delegate', 'transfer-fee-config', 'transfer-hook'],
      })],
    );

    const token2022Recommendation = recommendations.find((recommendation) => recommendation.topic === 'token-2022');
    expect(token2022Recommendation).toBeDefined();
    expect(token2022Recommendation?.sourceSignalType).not.toBe('token-2022-permanent-delegate');
  });

  it('does not map token-2022-permanent-delegate to delegated-authority lessons', () => {
    const recommendations = recommendWalletTraining(
      [account({ tokenAccountAddress: 'perm-delegate-1', mintAddress: 'mint-1', program: 'token-2022' })],
      [mintInspection({ mintAddress: 'mint-1', program: 'token-2022', token2022Extensions: ['permanent-delegate'] })],
    );

    expect(recommendations.some((recommendation) => recommendation.sourceSignalType === 'token-2022-permanent-delegate')).toBe(false);
    expect(recommendations.some((recommendation) => recommendation.topic === 'delegated-authority')).toBe(false);
  });

  it('treats token-2022 default-account-state initialized as informational topic mapping', () => {
    const recommendations = recommendWalletTraining(
      [account({ tokenAccountAddress: 'default-state-init', mintAddress: 'mint-1', program: 'token-2022' })],
      [mintInspection({
        mintAddress: 'mint-1',
        program: 'token-2022',
        token2022Extensions: ['default-account-state'],
        defaultAccountState: 'initialized',
      })],
    );

    expect(recommendations.some((recommendation) => recommendation.sourceSignalType === 'token-2022-default-account-state')).toBe(true);
  });

  it('deduplicates mint-level recommendations by mint+signal across multiple accounts sharing a mint', () => {
    const recommendations = recommendWalletTraining(
      [
        account({ tokenAccountAddress: 'acct-1', mintAddress: 'mint-1', program: 'token-2022' }),
        account({ tokenAccountAddress: 'acct-2', mintAddress: 'mint-1', program: 'token-2022' }),
        account({ tokenAccountAddress: 'acct-3', mintAddress: 'mint-1', program: 'token-2022' }),
      ],
      [mintInspection({
        mintAddress: 'mint-1',
        program: 'token-2022',
        token2022Extensions: ['transfer-hook'],
      })],
    );

    const transferHookRecommendation = recommendations.find((recommendation) => recommendation.sourceSignalType === 'token-2022-transfer-hook');
    expect(transferHookRecommendation?.observedAccountCount).toBe(1);
  });

  it('counts mint-level recommendations separately when different mints share the same signal kind', () => {
    const recommendations = recommendWalletTraining(
      [
        account({ tokenAccountAddress: 'acct-1', mintAddress: 'mint-1', program: 'token-2022' }),
        account({ tokenAccountAddress: 'acct-2', mintAddress: 'mint-2', program: 'token-2022' }),
      ],
      [
        mintInspection({ mintAddress: 'mint-1', program: 'token-2022', token2022Extensions: ['transfer-hook'] }),
        mintInspection({ mintAddress: 'mint-2', program: 'token-2022', token2022Extensions: ['transfer-hook'] }),
      ],
    );

    const transferHookRecommendation = recommendations.find((recommendation) => recommendation.sourceSignalType === 'token-2022-transfer-hook');
    expect(transferHookRecommendation?.observedAccountCount).toBe(2);
  });

  it('keeps account-level signal counting per account even when accounts share the same mint', () => {
    const recommendations = recommendWalletTraining(
      [
        account({ tokenAccountAddress: 'delegated-1', mintAddress: 'mint-1', delegateAddress: 'delegate-1' }),
        account({ tokenAccountAddress: 'delegated-2', mintAddress: 'mint-1', delegateAddress: 'delegate-2' }),
      ],
      [mintInspection({ mintAddress: 'mint-1' })],
    );

    const delegatedRecommendation = recommendations.find((recommendation) => recommendation.sourceSignalType === 'delegated-account');
    expect(delegatedRecommendation?.observedAccountCount).toBe(2);
  });

  it('does not force recommendations for authority-only mint signals without fitting lessons', () => {
    const recommendations = recommendWalletTraining(
      [account({ tokenAccountAddress: 'authority-only', mintAddress: 'mint-1' })],
      [mintInspection({ mintAddress: 'mint-1', mintAuthorityState: 'active', freezeAuthorityState: 'active' })],
    );

    expect(recommendations.some((recommendation) => recommendation.sourceSignalType === 'mint-authority-active')).toBe(false);
    expect(recommendations.some((recommendation) => recommendation.sourceSignalType === 'freeze-authority-active')).toBe(false);
  });

  it('derives observed-account counts for each recommendation from real grouped signal matches', () => {
    const recommendations = recommendWalletTraining([
      account({ tokenAccountAddress: 'frozen-1', state: 'frozen', program: 'token-2022' }),
      account({ tokenAccountAddress: 'frozen-2', state: 'frozen' }),
      account({ tokenAccountAddress: 'token-2022-2', program: 'token-2022' }),
    ]);

    const byTopic = Object.fromEntries(recommendations.map((recommendation) => [recommendation.topic, recommendation]));
    expect(byTopic['token-account-state']?.observedAccountCount).toBe(2);
    expect(byTopic['token-2022']?.observedAccountCount).toBe(2);
  });
});
