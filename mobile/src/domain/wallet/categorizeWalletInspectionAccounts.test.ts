import { describe, expect, it } from 'vitest';

import type { WalletTokenAccountInspection } from '@/types/walletInspection';
import { categorizeWalletInspectionAccounts } from './categorizeWalletInspectionAccounts';
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

describe('categorizeWalletInspectionAccounts', () => {
  it('categorizes frozen accounts as review', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A', state: 'frozen' }),
    ]);

    expect(categorized.summary.reviewAccountCount).toBe(1);
    expect(categorized.summary.informationalAccountCount).toBe(0);
    expect(categorized.summary.noReviewSignalAccountCount).toBe(0);
  });

  it('categorizes delegated accounts as review', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A', delegateAddress: 'delegate', delegatedAmountRaw: '5' }),
    ]);

    expect(categorized.summary.reviewAccountCount).toBe(1);
  });

  it('categorizes token-2022-only accounts as informational', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A', program: 'token-2022' }),
    ]);

    expect(categorized.summary.reviewAccountCount).toBe(0);
    expect(categorized.summary.informationalAccountCount).toBe(1);
  });

  it('categorizes empty-only accounts as informational', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A', rawAmount: '0', uiAmount: 0 }),
    ]);

    expect(categorized.summary.reviewAccountCount).toBe(0);
    expect(categorized.summary.informationalAccountCount).toBe(1);
  });

  it('categorizes ordinary accounts as normal', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A' }),
    ]);

    expect(categorized.summary.reviewAccountCount).toBe(0);
    expect(categorized.summary.informationalAccountCount).toBe(0);
    expect(categorized.summary.noReviewSignalAccountCount).toBe(1);
  });

  it('uses review precedence over informational for frozen + token-2022', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A', state: 'frozen', program: 'token-2022' }),
    ]);

    expect(categorized.summary.reviewAccountCount).toBe(1);
    expect(categorized.summary.informationalAccountCount).toBe(0);
  });

  it('uses review precedence over informational for delegated + token-2022', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A', delegateAddress: 'delegate', delegatedAmountRaw: '1', program: 'token-2022' }),
    ]);

    expect(categorized.summary.reviewAccountCount).toBe(1);
    expect(categorized.summary.informationalAccountCount).toBe(0);
  });

  it('does not double-count primary categories and totals equal inspected count', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A', state: 'frozen', program: 'token-2022' }),
      account({ tokenAccountAddress: 'B', rawAmount: '0', uiAmount: 0 }),
      account({ tokenAccountAddress: 'C' }),
    ]);

    const summary = categorized.summary;
    expect(summary.inspectedAccountCount).toBe(3);
    expect(summary.reviewAccountCount).toBe(1);
    expect(summary.informationalAccountCount).toBe(1);
    expect(summary.noReviewSignalAccountCount).toBe(1);
    expect(summary.reviewAccountCount + summary.informationalAccountCount + summary.noReviewSignalAccountCount).toBe(summary.inspectedAccountCount);
  });

  it('supports zero review accounts', () => {
    const categorized = categorizeWalletInspectionAccounts([
      account({ tokenAccountAddress: 'A', program: 'token-2022' }),
      account({ tokenAccountAddress: 'B' }),
    ]);

    expect(categorized.summary.reviewAccountCount).toBe(0);
    expect(categorized.summary.informationalAccountCount).toBe(1);
    expect(categorized.summary.noReviewSignalAccountCount).toBe(1);
  });

  it('keeps exclusive top-level categories while allowing technical overlap (30/3/10/17 with 11 token-2022)', () => {
    const accounts: WalletTokenAccountInspection[] = [];

    for (let i = 0; i < 2; i += 1) {
      accounts.push(account({
        tokenAccountAddress: `review-frozen-${i}`,
        state: 'frozen',
      }));
    }

    accounts.push(account({
      tokenAccountAddress: 'review-frozen-token2022-overlap',
      state: 'frozen',
      program: 'token-2022',
      rawAmount: '0',
      uiAmount: 0,
    }));

    for (let i = 0; i < 10; i += 1) {
      accounts.push(account({
        tokenAccountAddress: `informational-token2022-${i}`,
        program: 'token-2022',
      }));
    }

    for (let i = 0; i < 17; i += 1) {
      accounts.push(account({
        tokenAccountAddress: `normal-${i}`,
      }));
    }

    const categorized = categorizeWalletInspectionAccounts(accounts);
    const technicalSummary = summarizeWalletInspection(accounts);

    expect(categorized.summary.inspectedAccountCount).toBe(30);
    expect(categorized.summary.reviewAccountCount).toBe(3);
    expect(categorized.summary.informationalAccountCount).toBe(10);
    expect(categorized.summary.noReviewSignalAccountCount).toBe(17);
    expect(categorized.summary.reviewAccountCount + categorized.summary.informationalAccountCount + categorized.summary.noReviewSignalAccountCount).toBe(30);

    expect(technicalSummary.frozenTokenAccounts).toBe(3);
    expect(technicalSummary.delegatedTokenAccounts).toBe(0);
    expect(technicalSummary.token2022TokenAccounts).toBe(11);
    expect(technicalSummary.emptyTokenAccounts).toBe(1);
  });
});
