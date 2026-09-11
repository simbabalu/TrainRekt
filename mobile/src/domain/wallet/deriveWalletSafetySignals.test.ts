import { describe, expect, it } from 'vitest';

import type { WalletTokenAccountInspection } from '@/types/walletInspection';
import { deriveWalletSafetySignals } from './deriveWalletSafetySignals';

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

describe('deriveWalletSafetySignals', () => {
  it('returns no signals for a standard initialized SPL account', () => {
    const signals = deriveWalletSafetySignals([account({})]);
    expect(signals).toHaveLength(0);
  });

  it('derives delegated-account signal', () => {
    const signals = deriveWalletSafetySignals([
      account({
        delegateAddress: '5xyz6w8d9R9Mi7qQhJpQ2EwAx89jWQ5gKoM1dY2pr4a',
        delegatedAmountRaw: '7',
      }),
    ]);

    expect(signals.map((signal) => signal.kind)).toContain('delegated-account');
    expect(signals.find((signal) => signal.kind === 'delegated-account')?.category).toBe('review');
    expect(signals[0].educationalText).toContain('delegated authority');
  });

  it('derives frozen-account signal', () => {
    const signals = deriveWalletSafetySignals([account({ state: 'frozen' })]);
    expect(signals.map((signal) => signal.kind)).toContain('frozen-account');
    expect(signals.find((signal) => signal.kind === 'frozen-account')?.category).toBe('review');
  });

  it('derives token-2022 signal', () => {
    const signals = deriveWalletSafetySignals([account({ program: 'token-2022' })]);
    expect(signals.map((signal) => signal.kind)).toContain('token-2022-account');
    expect(signals.find((signal) => signal.kind === 'token-2022-account')?.category).toBe('informational');
    expect(signals.find((signal) => signal.kind === 'token-2022-account')?.educationalText).toContain('itself is not a warning');
  });

  it('derives empty-token-account signal for zero-balance account', () => {
    const signals = deriveWalletSafetySignals([account({ rawAmount: '0', uiAmount: 0 })]);
    expect(signals.map((signal) => signal.kind)).toContain('empty-token-account');
    expect(signals.find((signal) => signal.kind === 'empty-token-account')?.category).toBe('informational');
  });

  it('produces multiple signals from one account when multiple conditions match', () => {
    const signals = deriveWalletSafetySignals([
      account({
        rawAmount: '0',
        uiAmount: 0,
        state: 'frozen',
        delegateAddress: '5xyz6w8d9R9Mi7qQhJpQ2EwAx89jWQ5gKoM1dY2pr4a',
        delegatedAmountRaw: '1',
        program: 'token-2022',
      }),
    ]);

    expect(signals).toHaveLength(4);
    expect(new Set(signals.map((signal) => signal.kind))).toEqual(
      new Set(['delegated-account', 'frozen-account', 'token-2022-account', 'empty-token-account']),
    );
  });
});
