import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { WalletSafetyInspection as WalletSafetyInspectionModel } from '@/types/walletInspection';
import { WalletSafetyInspection } from './WalletSafetyInspection';

vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => React.createElement('Pressable', { onPress, disabled }, React.createElement('Text', null, children)),
}));

vi.mock('@/components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));

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

function createInspection(): WalletSafetyInspectionModel {
  return {
    address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
    network: 'mainnet-beta',
    inspectedAt: new Date().toISOString(),
    warnings: [],
    tokenAccounts: [
      {
        tokenAccountAddress: '8hKg4KTFW4v8gQ4wmAq9g8cz7L1w3Q2k4Cm6GxYJ9QaP',
        mintAddress: '7abcaP5gn3pW7N7fH9t9cY6wMxyuGvG3RkRkK4n4xYz',
        program: 'token-2022',
        rawAmount: '0',
        decimals: 6,
        uiAmount: 0,
        state: 'frozen',
        delegateAddress: '5xyz6w8d9R9Mi7qQhJpQ2EwAx89jWQ5gKoM1dY2pr4a',
        delegatedAmountRaw: '10',
        closeAuthorityAddress: null,
      },
      {
        tokenAccountAddress: '9YpkJ2nA3Nf3u7Ggx5dFjoW7kTZJtZsU6GLkQW2gQx3m',
        mintAddress: '4S8QXQfR5wtvN62N46mS8MQaCF7WysNh4M8s6Tx5w8na',
        program: 'spl-token',
        rawAmount: '3',
        decimals: 0,
        uiAmount: 3,
        state: 'initialized',
        delegateAddress: null,
        delegatedAmountRaw: null,
        closeAuthorityAddress: null,
      },
    ],
  };
}

describe('WalletSafetyInspection', () => {
  function createHarness(props: Partial<React.ComponentProps<typeof WalletSafetyInspection>> = {}) {
    return (
      <WalletSafetyInspection
        connected
        status="success"
        viewMode="review"
        inspection={createInspection()}
        error={null}
        onViewModeChange={vi.fn()}
        onRefresh={vi.fn()}
        {...props}
      />
    );
  }

  it('renders account-category summary with precedence-safe semantics', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(createHarness());
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('WALLET SAFETY INSPECTION');
    expect(text).toContain('accounts inspected');
    expect(text).toContain('1 NEED REVIEW');
    expect(text).toContain('0 INFORMATIONAL');
    expect(text).toContain('1 NO REVIEW SIGNALS');
    expect(text).toContain('Review categories are exclusive. Technical signals may overlap.');
    expect(text).toContain('FROZEN');
    expect(text).toContain('DELEGATED');
    expect(text).toContain('TOKEN-2022');
    expect(text).not.toContain('Signals found');
  });

  it('default view only lists accounts that need review', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(createHarness({ viewMode: 'review' }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('NEEDS REVIEW (1)');
    expect(text).toContain('FROZEN');
    expect(text).not.toContain('9YpkJ2nA3Nf3u7Ggx5dFjoW7kTZJtZsU6GLkQW2gQx3m');
  });

  it('shows explicit no-review message when there are zero review accounts', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      {
        ...inspection.tokenAccounts[1],
        tokenAccountAddress: '2WYjMFiP1DyfyTHx7Ems7VgGdwpBBQHiq3XZaQev8NsK',
        mintAddress: '8mN4deStnQQkvDC2XxN2HfFThfDrWdrqA3qv8n9ydTnF',
        program: 'token-2022',
      },
    ];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ inspection, viewMode: 'review' }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('No review signals detected in the inspected token accounts.');
  });

  it('renders informational and all-account controls when informational accounts exist', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      {
        ...inspection.tokenAccounts[0],
        tokenAccountAddress: 'info-only',
        state: 'initialized',
        delegateAddress: null,
      },
      {
        ...inspection.tokenAccounts[1],
      },
    ];

    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(createHarness({ inspection }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('SHOW INFORMATIONAL (1)');
    expect(text).toContain('SHOW ALL 2 ACCOUNTS');
  });

  it('renders informational list when view mode is informational', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      {
        ...inspection.tokenAccounts[0],
        tokenAccountAddress: 'A1',
        state: 'initialized',
        delegateAddress: null,
      },
      {
        ...inspection.tokenAccounts[1],
        tokenAccountAddress: 'B1',
        program: 'token-2022',
      },
    ];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ inspection, viewMode: 'informational' }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('INFORMATIONAL (2)');
    expect(text).toContain('Token-2022 is informational. Token-2022 itself is not a warning.');
    expect(text).not.toContain('No review signals detected in the inspected token accounts.');
  });

  it('renders all accounts without duplicate rows in all mode', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      {
        ...inspection.tokenAccounts[0],
        tokenAccountAddress: 'dup-account',
      },
      {
        ...inspection.tokenAccounts[1],
        tokenAccountAddress: 'plain-account',
      },
    ];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ inspection, viewMode: 'all' }));
    });

    const text = flattenText(renderer.toJSON());
    const detailsMatches = (text.match(/DETAILS/g) ?? []).length;

    expect(text).toContain('SHOWING ALL ACCOUNTS (2)');
    expect(detailsMatches).toBe(2);
  });

  it('renders partial-failure message and warnings without hiding successful data', () => {
    const inspection = createInspection();
    inspection.warnings = ['Token-2022 account inspection could not be completed.'];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ status: 'partial', inspection }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Inspection completed with partial results.');
    expect(text).toContain('Token-2022 account inspection could not be completed.');
    expect(text).toContain('accounts inspected');
  });

  it('renders unavailable state with retry action', () => {
    const onRefresh = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(createHarness({ status: 'unavailable', inspection: null, error: 'Wallet inspection is temporarily unavailable. Please try again.', onRefresh }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('Wallet inspection is temporarily unavailable. Please try again.');
    expect(text).toContain('RETRY INSPECTION');

    const retryButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      retryButton.props.onPress();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
