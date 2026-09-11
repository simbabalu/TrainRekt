import { describe, expect, it } from 'vitest';

import type { WalletMintInspection, WalletTokenAccountInspection } from '@/types/walletInspection';
import { deriveWalletSafetySignals, deriveWalletSafetySignalsWithMints } from './deriveWalletSafetySignals';

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

function mintInspection(overrides: Partial<WalletMintInspection>): WalletMintInspection {
  return {
    mintAddress: '7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYz',
    program: 'spl-token',
    decimals: 6,
    supplyRaw: '1000000',
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

  it('derives mint-authority-active and freeze-authority-active as review signals when present', () => {
    const signals = deriveWalletSafetySignalsWithMints(
      [account({})],
      [mintInspection({ mintAuthorityState: 'active', freezeAuthorityState: 'active' })],
    );

    expect(signals.map((signal) => signal.kind)).toContain('mint-authority-active');
    expect(signals.map((signal) => signal.kind)).toContain('freeze-authority-active');
    expect(signals.find((signal) => signal.kind === 'mint-authority-active')?.category).toBe('review');
    expect(signals.find((signal) => signal.kind === 'freeze-authority-active')?.category).toBe('review');
  });

  it('derives supported Token-2022 extension signals from mint facts', () => {
    const signals = deriveWalletSafetySignalsWithMints(
      [account({ program: 'token-2022' })],
      [mintInspection({
        program: 'token-2022',
        token2022Extensions: [
          'permanent-delegate',
          'transfer-fee-config',
          'transfer-hook',
          'non-transferable',
          'default-account-state',
          'interest-bearing-config',
          'metadata-pointer',
          'group-pointer',
          'group-member-pointer',
        ],
        defaultAccountState: 'frozen',
      })],
    );

    expect(signals.map((signal) => signal.kind)).toEqual(expect.arrayContaining([
      'token-2022-account',
      'token-2022-permanent-delegate',
      'token-2022-transfer-fee-config',
      'token-2022-transfer-hook',
      'token-2022-non-transferable',
      'token-2022-default-account-state',
      'token-2022-interest-bearing-config',
      'token-2022-metadata-pointer',
      'token-2022-group-pointer',
      'token-2022-group-member-pointer',
    ]));
  });

  it('classifies default-account-state frozen as review', () => {
    const signals = deriveWalletSafetySignalsWithMints(
      [account({ program: 'token-2022' })],
      [mintInspection({
        program: 'token-2022',
        token2022Extensions: ['default-account-state'],
        defaultAccountState: 'frozen',
      })],
    );

    const signal = signals.find((entry) => entry.kind === 'token-2022-default-account-state');
    expect(signal?.category).toBe('review');
  });

  it('classifies default-account-state initialized as informational', () => {
    const signals = deriveWalletSafetySignalsWithMints(
      [account({ program: 'token-2022' })],
      [mintInspection({
        program: 'token-2022',
        token2022Extensions: ['default-account-state'],
        defaultAccountState: 'initialized',
      })],
    );

    const signal = signals.find((entry) => entry.kind === 'token-2022-default-account-state');
    expect(signal?.category).toBe('informational');
  });

  it('does not fabricate default-account-state severity when state is unknown or unavailable', () => {
    const withUnknownState = deriveWalletSafetySignalsWithMints(
      [account({ program: 'token-2022' })],
      [mintInspection({
        program: 'token-2022',
        token2022Extensions: ['default-account-state'],
        defaultAccountState: 'unknown',
      })],
    );
    const withUnavailableState = deriveWalletSafetySignalsWithMints(
      [account({ program: 'token-2022' })],
      [mintInspection({
        program: 'token-2022',
        token2022Extensions: ['default-account-state'],
        defaultAccountState: null,
      })],
    );

    expect(withUnknownState.some((entry) => entry.kind === 'token-2022-default-account-state')).toBe(false);
    expect(withUnavailableState.some((entry) => entry.kind === 'token-2022-default-account-state')).toBe(false);
  });

  it('treats Token-2022 alone as informational and never as dangerous wording', () => {
    const signals = deriveWalletSafetySignals([account({ program: 'token-2022' })]);
    const token2022Signal = signals.find((signal) => signal.kind === 'token-2022-account');
    expect(token2022Signal?.category).toBe('informational');
    expect((token2022Signal?.educationalText ?? '').toLowerCase()).not.toContain('scam');
    expect((token2022Signal?.educationalText ?? '').toLowerCase()).not.toContain('unsafe');
  });

  it('does not claim safety guarantees when authorities are revoked', () => {
    const signals = deriveWalletSafetySignalsWithMints(
      [account({})],
      [mintInspection({ mintAuthorityState: 'revoked', freezeAuthorityState: 'revoked' })],
    );
    expect(signals.map((signal) => signal.kind)).not.toContain('mint-authority-active');
    expect(signals.map((signal) => signal.kind)).not.toContain('freeze-authority-active');
    expect(signals.some((signal) => signal.educationalText.toLowerCase().includes('safe'))).toBe(false);
  });
});
