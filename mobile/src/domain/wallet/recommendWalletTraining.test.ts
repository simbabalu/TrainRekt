import { describe, expect, it } from 'vitest';

import type { WalletTokenAccountInspection } from '@/types/walletInspection';
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
