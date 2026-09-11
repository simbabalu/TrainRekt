import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { WalletSafetyInspection as WalletSafetyInspectionModel } from '@/types/walletInspection';
import { WalletSafetyInspection } from './WalletSafetyInspection';

const pushMock = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => React.createElement('Pressable', { onPress, disabled }, React.createElement('Text', null, children)),
}));

vi.mock('@/components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));

vi.mock('@/components/AppIcon', () => ({
  AppIcon: () => React.createElement('View', null),
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
  if (value && typeof value === 'object' && 'props' in value) return flattenText((value as { props?: { children?: unknown } }).props?.children);
  return '';
}

function createInspection(): WalletSafetyInspectionModel {
  return {
    address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
    network: 'mainnet-beta',
    inspectedAt: new Date().toISOString(),
    warnings: [],
    mintInspections: [],
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
    expect(text).toContain('LEARN FROM YOUR WALLET');
    expect(text).toContain('TOKEN ACCOUNT STATES');
    expect(text).toContain('DELEGATED AUTHORITY');
    expect(/1\s+account\s+observed/.test(text)).toBe(true);
    expect(text).not.toContain('Signals found');
    expect(text).not.toContain('WHY THIS MATTERS');
  });

  it('shows recommendations only for observed wallet signal topics', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      {
        ...inspection.tokenAccounts[0],
        tokenAccountAddress: 'only-token-2022',
        state: 'initialized',
        delegateAddress: null,
        rawAmount: '10',
      },
    ];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ inspection }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('TOKEN-2022');
    expect(text).not.toContain('DELEGATED AUTHORITY');
    expect(text).not.toContain('TOKEN ACCOUNT STATES');
    expect(text).not.toContain('EMPTY TOKEN ACCOUNTS');
  });

  it('renders mixed Token-2022 extension recommendations without crashing', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      {
        ...inspection.tokenAccounts[0],
        tokenAccountAddress: 'token-2022-mixed-1',
        mintAddress: 'mint-mixed-1',
        program: 'token-2022',
        state: 'initialized',
        delegateAddress: null,
        rawAmount: '5',
        uiAmount: 5,
      },
      {
        ...inspection.tokenAccounts[0],
        tokenAccountAddress: 'token-2022-mixed-2',
        mintAddress: 'mint-mixed-1',
        program: 'token-2022',
        state: 'initialized',
        delegateAddress: null,
        rawAmount: '7',
        uiAmount: 7,
      },
    ];
    inspection.mintInspections = [{
      mintAddress: 'mint-mixed-1',
      program: 'token-2022',
      decimals: 6,
      supplyRaw: '1000',
      mintAuthorityState: 'revoked',
      mintAuthorityAddress: null,
      freezeAuthorityState: 'revoked',
      freezeAuthorityAddress: null,
      token2022Extensions: ['transfer-fee-config', 'transfer-hook', 'default-account-state', 'permanent-delegate'],
      defaultAccountState: 'initialized',
      unavailableReason: null,
    }];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ inspection }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('TOKEN-2022');
    expect(text).toContain('TOKEN ACCOUNT STATES');
    expect((text.match(/START LESSON/g) ?? []).length).toBe(2);
  });

  it('shows the latest wallet lesson result on the matching recommendation card', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      { ...inspection.tokenAccounts[0], state: 'frozen', delegateAddress: null },
    ];
    const walletLessonProgress = {
      'wallet-lesson-frozen-account-state': {
        passed: true,
        completedAt: '2026-09-11T11:00:00.000Z',
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ inspection, walletLessonProgress }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('PASSED');
    expect(text).toContain('Completed');
    expect(text).toContain('RETRY LESSON');
    expect((text.match(/START LESSON/g) ?? []).length).toBe(2);
  });

  it('keeps FAILED/PASSED recommendation status independent from bounded recent history', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [{ ...inspection.tokenAccounts[0], state: 'frozen', delegateAddress: null }];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({
        inspection,
        walletLessonProgress: {
          'wallet-lesson-frozen-account-state': {
            passed: false,
            completedAt: '2026-09-11T09:00:00.000Z',
          },
        },
      }));
    });

    expect(flattenText(renderer.toJSON())).toContain('FAILED');

    act(() => {
      renderer.update(createHarness({
        inspection,
        walletLessonProgress: {
          'wallet-lesson-frozen-account-state': {
            passed: true,
            completedAt: '2026-09-11T10:00:00.000Z',
          },
        },
      }));
    });

    expect(flattenText(renderer.toJSON())).toContain('PASSED');
  });

  it('routes START LESSON into Train practice mode with wallet source params', () => {
    pushMock.mockReset();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness());
    });

    const buttons = renderer.root.findAll((node) => String(node.type) === 'Pressable');
    const startLessonButton = buttons.find((node) => flattenText(node).includes('START LESSON'));
    expect(startLessonButton).toBeDefined();

    act(() => {
      startLessonButton?.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith({
      pathname: '/train',
      params: expect.objectContaining({
        mode: 'practice',
        source: 'wallet',
        topic: expect.any(String),
        exerciseId: expect.any(String),
      }),
    });
  });

  it('renders neutral recommendation fallback when no wallet training topics are found', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      {
        ...inspection.tokenAccounts[1],
        tokenAccountAddress: 'normal-1',
        program: 'spl-token',
        rawAmount: '7',
        state: 'initialized',
        delegateAddress: null,
      },
    ];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ inspection }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text).toContain('No review signals found. You can still practice general wallet-safety lessons.');
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
    expect(text).not.toContain('REFRESH INSPECTION');
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
    expect((text.match(/DETAILS/g) ?? []).length).toBe(2);
    expect(text).not.toContain('No review signals detected in the inspected token accounts.');
  });

  it('collapses informational accounts back to review-only mode', () => {
    const onViewModeChange = vi.fn();
    const inspection = createInspection();
    inspection.tokenAccounts = [{
      ...inspection.tokenAccounts[1],
      tokenAccountAddress: 'informational-only',
      program: 'token-2022',
    }];
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(createHarness({ inspection, viewMode: 'informational', onViewModeChange }));
    });

    const hideButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')
      .find((node) => flattenText(node).includes('HIDE INFORMATIONAL'));
    expect(hideButton).toBeDefined();
    act(() => hideButton?.props.onPress());
    expect(onViewModeChange).toHaveBeenCalledWith('review');
  });

  it('places wallet lessons before secondary account disclosures', () => {
    const inspection = createInspection();
    inspection.tokenAccounts = [
      { ...inspection.tokenAccounts[0], tokenAccountAddress: 'review-account' },
      { ...inspection.tokenAccounts[1], tokenAccountAddress: 'informational-account', program: 'token-2022' },
    ];
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(createHarness({ inspection }));
    });

    const text = flattenText(renderer.toJSON());
    expect(text.indexOf('LEARN FROM YOUR WALLET')).toBeGreaterThan(-1);
    expect(text.indexOf('LEARN FROM YOUR WALLET')).toBeLessThan(text.indexOf('SHOW INFORMATIONAL'));
    expect((text.match(/DETAILS/g) ?? []).length).toBe(1);
  });

  it('uses explicit disclosure transitions without rendering duplicate account rows', () => {
    const onViewModeChange = vi.fn();
    const inspection = createInspection();
    inspection.tokenAccounts = [
      { ...inspection.tokenAccounts[0], tokenAccountAddress: 'review-account' },
      { ...inspection.tokenAccounts[1], tokenAccountAddress: 'normal-account' },
      { ...inspection.tokenAccounts[1], tokenAccountAddress: 'informational-account', program: 'token-2022' },
    ];

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(createHarness({ inspection, onViewModeChange }));
    });

    const initialText = flattenText(renderer.toJSON());
    expect((initialText.match(/DETAILS/g) ?? []).length).toBe(1);
    expect(initialText).not.toContain('normal-account');
    expect(initialText).not.toContain('informational-account');

    const buttons = renderer.root.findAll((node) => String(node.type) === 'Pressable');
    const informationalButton = buttons.find((node) => flattenText(node).includes('SHOW INFORMATIONAL'));
    const allButton = buttons.find((node) => flattenText(node).includes('SHOW ALL'));

    act(() => informationalButton?.props.onPress());
    expect(onViewModeChange).toHaveBeenCalledWith('informational');
    act(() => allButton?.props.onPress());
    expect(onViewModeChange).toHaveBeenCalledWith('all');
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
