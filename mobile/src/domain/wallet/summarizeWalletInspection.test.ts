import { describe, expect, it } from 'vitest';

import type { WalletTokenAccountInspection } from '@/types/walletInspection';
import { summarizeWalletInspection } from './summarizeWalletInspection';

function account(overrides: Partial<WalletTokenAccountInspection>): WalletTokenAccountInspection {
  return {
    tokenAccountAddress: '8hKg4KTFW4v8gQ4wmAq9g8cz7L1w3Q2k4Cm6GxYJ9QaP',
    mintAddress: '7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYz',
    program: 'spl-token',
    rawAmount: '10',
    decimals: 6,
    uiAmount: 0.00001,
    state: 'initialized',
    delegateAddress: null,
    delegatedAmountRaw: null,
    closeAuthorityAddress: null,
    ...overrides,
  };
}

describe('summarizeWalletInspection', () => {
  it('summarizes mixed wallet inspection counts', () => {
    const summary = summarizeWalletInspection([
      account({ tokenAccountAddress: 'A', rawAmount: '0', uiAmount: 0 }),
      account({ tokenAccountAddress: 'B', state: 'frozen' }),
      account({ tokenAccountAddress: 'C', delegateAddress: 'delegate', delegatedAmountRaw: '5' }),
      account({ tokenAccountAddress: 'D', program: 'token-2022' }),
      account({ tokenAccountAddress: 'E', program: 'token-2022', rawAmount: '0', uiAmount: 0 }),
    ]);

    expect(summary.reviewedTokenAccounts).toBe(5);
    expect(summary.emptyTokenAccounts).toBe(2);
    expect(summary.frozenTokenAccounts).toBe(1);
    expect(summary.delegatedTokenAccounts).toBe(1);
    expect(summary.token2022TokenAccounts).toBe(2);
  });

  it('returns zeros for empty input', () => {
    const summary = summarizeWalletInspection([]);
    expect(summary).toEqual({
      reviewedTokenAccounts: 0,
      emptyTokenAccounts: 0,
      frozenTokenAccounts: 0,
      delegatedTokenAccounts: 0,
      token2022TokenAccounts: 0,
    });
  });
});
