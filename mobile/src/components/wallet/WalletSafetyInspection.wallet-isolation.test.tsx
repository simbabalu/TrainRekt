import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { WalletSafetyInspection } from './WalletSafetyInspection';

const walletServiceMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  signMessage: vi.fn(),
  signMessages: vi.fn(),
  signTransaction: vi.fn(),
  signTransactions: vi.fn(),
  signAndSendTransactions: vi.fn(),
  sendTransaction: vi.fn(),
  submitTransaction: vi.fn(),
  deauthorize: vi.fn(),
}));

const pushMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/wallet/mobileWalletService', () => ({
  mobileWalletService: walletServiceMock,
}));

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

describe('WalletSafetyInspection wallet isolation', () => {
  it('start lesson interaction routes internally and never calls wallet signing, transaction, or deauthorize methods', () => {
    pushMock.mockReset();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <WalletSafetyInspection
          connected
          status="success"
          viewMode="review"
          inspection={{
            address: '7xKsKjA24sPuPqYxWwBfQ9cj2k9WqP1FfGS6db5CwPH',
            network: 'mainnet-beta',
            inspectedAt: new Date().toISOString(),
            warnings: [],
                  mintInspections: [],
                  tokenAccounts: [
              {
                tokenAccountAddress: 'signal-1',
                mintAddress: 'mint-1',
                program: 'spl-token',
                rawAmount: '2',
                decimals: 0,
                uiAmount: 2,
                state: 'frozen',
                delegateAddress: null,
                delegatedAmountRaw: null,
                closeAuthorityAddress: null,
              },
            ],
          }}
          error={null}
          onViewModeChange={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );
    });

    const buttons = renderer.root.findAll((node) => String(node.type) === 'Pressable');
    const startLessonButton = buttons.find((node) => flattenText(node).includes('START LESSON'));

    expect(startLessonButton).toBeDefined();
    act(() => {
      startLessonButton?.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessage).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessages).not.toHaveBeenCalled();
    expect(walletServiceMock.signTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.signTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.signAndSendTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.sendTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.submitTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.deauthorize).not.toHaveBeenCalled();
  });

  it('refresh inspection interaction never calls wallet signing, transaction, or deauthorize methods', () => {
    const onRefresh = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <WalletSafetyInspection
          connected
          status="unavailable"
          viewMode="review"
          inspection={null}
          error={null}
          onViewModeChange={vi.fn()}
          onRefresh={onRefresh}
        />,
      );
    });

    const refreshButton = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];

    expect(refreshButton).toBeDefined();
    act(() => {
      refreshButton.props.onPress();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessage).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessages).not.toHaveBeenCalled();
    expect(walletServiceMock.signTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.signTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.signAndSendTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.sendTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.submitTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.deauthorize).not.toHaveBeenCalled();
  });
});
