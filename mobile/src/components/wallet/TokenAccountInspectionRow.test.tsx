import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { WalletTokenAccountInspection } from '@/types/walletInspection';
import { TokenAccountInspectionRow } from './TokenAccountInspectionRow';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

function flattenText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return flattenText(value.children);
  return '';
}

function account(overrides: Partial<WalletTokenAccountInspection>): WalletTokenAccountInspection {
  return {
    tokenAccountAddress: '8hKg4KTFW4v8gQ4wmAq9g8cz7L1w3Q2k4Cm6GxYJ9QaP',
    mintAddress: '7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYz',
    program: 'token-2022',
    rawAmount: '0',
    decimals: 6,
    uiAmount: 0,
    state: 'frozen',
    delegateAddress: '5xyz6w8d9R9Mi7qQhJpQ2EwAx89jWQ5gKoM1dY2pr4a',
    delegatedAmountRaw: '4',
    closeAuthorityAddress: null,
    ...overrides,
  };
}

describe('TokenAccountInspectionRow', () => {
  it('renders compact collapsed row then expands with full details on press', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TokenAccountInspectionRow account={account({})} />);
    });

    const collapsed = flattenText(renderer.toJSON());
    expect(collapsed).toContain('Unknown Token');
    expect(collapsed).toContain('Mint:');
    expect(collapsed).toContain('DETAILS');
    expect(collapsed).toContain('TOKEN-2022');
    expect(collapsed).toContain('DELEGATED');
    expect(collapsed).not.toContain('TOKEN ACCOUNT');

    const rowPressable = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      rowPressable.props.onPress();
    });

    const expanded = flattenText(renderer.toJSON());
    expect(expanded).toContain('HIDE');
    expect(expanded).toContain('TOKEN ACCOUNT');
    expect(expanded).toContain('PROGRAM');
    expect(expanded).toContain('STATE');
    expect(expanded).toContain('DELEGATE');
    expect(expanded).toContain('DELEGATED AMOUNT');
    expect(expanded).toContain('canonical identifier');
  });

  it('shows token name and symbol when both are available', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <TokenAccountInspectionRow
          account={account({ tokenDisplayMetadata: { mint: '7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYz', name: 'USD Coin', symbol: 'USDC' } })}
        />,
      );
    });

    const collapsed = flattenText(renderer.toJSON());
    expect(collapsed).toContain('USD Coin');
    expect(collapsed).toContain('USDC');
    expect(collapsed).toContain('FROZEN');
    expect(collapsed).toContain('DELEGATED');
    expect(collapsed).not.toContain('Unknown Token');
  });

  it('shows token name only when symbol is unavailable', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <TokenAccountInspectionRow
          account={account({ tokenDisplayMetadata: { mint: '7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYz', name: 'USD Coin', symbol: null } })}
        />,
      );
    });

    const collapsed = flattenText(renderer.toJSON());
    expect(collapsed).toContain('USD Coin');
    expect(collapsed).not.toContain('Unknown Token');
  });

  it('shows token symbol only when name is unavailable', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <TokenAccountInspectionRow
          account={account({ tokenDisplayMetadata: { mint: '7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYz', name: null, symbol: 'USDC' } })}
        />,
      );
    });

    const collapsed = flattenText(renderer.toJSON());
    expect(collapsed).toContain('USDC');
    expect(collapsed).not.toContain('Unknown Token');
  });

  it('falls back to unknown token when metadata is missing or malformed', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <TokenAccountInspectionRow
          account={account({ tokenDisplayMetadata: { mint: '7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYz', name: '   ', symbol: '' } })}
        />,
      );
    });

    const collapsed = flattenText(renderer.toJSON());
    expect(collapsed).toContain('Unknown Token');
    expect(collapsed).toContain('Mint:');
  });

  it('shows Unknown values for unknown state and unknown program', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TokenAccountInspectionRow account={account({ program: 'unknown', state: 'unknown' })} />);
    });

    const rowPressable = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      rowPressable.props.onPress();
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Unknown');
  });

  it('preserves long canonical addresses in expanded details', () => {
    const longTokenAccount = '84nH8hKg4KTFW4v8gQ4wmAq9g8cz7L1w3Q2k4Cm6GxYJ9QaP';
    const longMint = 'DhsS7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYzZoGq';

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TokenAccountInspectionRow
          account={account({
            tokenAccountAddress: longTokenAccount,
            mintAddress: longMint,
            state: 'initialized',
            delegateAddress: null,
            program: 'spl-token',
            rawAmount: '4',
            uiAmount: 4,
          })}
        />,
      );
    });

    const rowPressable = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      rowPressable.props.onPress();
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain(longTokenAccount);
    expect(text).toContain(longMint);
  });
});
