import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import { SurpriseChallengeModal } from './SurpriseChallengeModal';

const walletServiceMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  signMessage: vi.fn(),
  authorize: vi.fn(),
  reauthorize: vi.fn(),
  signMessages: vi.fn(),
  signTransactions: vi.fn(),
  signAndSendTransactions: vi.fn(),
  sendTransaction: vi.fn(),
  submitTransaction: vi.fn(),
}));

vi.mock('@/services/wallet/mobileWalletService', () => ({
  mobileWalletService: walletServiceMock,
}));

vi.mock('react-native', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

describe('SurpriseChallengeModal wallet isolation', () => {
  it('SIGN in surprise-airdrop-001 completes simulation locally and never calls wallet/native APIs', () => {
    const onChooseDecision = vi.fn();

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SurpriseChallengeModal
          session={{
            challenge: surpriseChallengeCatalog[0],
            stage: 'prompt',
            isPreview: false,
            countdownSecondsRemaining: 60,
            firstDecision: null,
            finalDecision: null,
            xpAwarded: 0,
            badgeEarned: false,
            outcomeTier: null,
            evaluation: null,
          }}
          onChooseDecision={onChooseDecision}
          onCloseReveal={vi.fn()}
        />,
      );
    });

    const signButton = renderer.root.find((node) => node.props.accessibilityLabel === 'SIGN surprise challenge action');
    act(() => {
      signButton.props.onPress();
    });

    expect(onChooseDecision).toHaveBeenCalledWith('sign');
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessage).not.toHaveBeenCalled();
    expect(walletServiceMock.authorize).not.toHaveBeenCalled();
    expect(walletServiceMock.reauthorize).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessages).not.toHaveBeenCalled();
    expect(walletServiceMock.signTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.signAndSendTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.sendTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.submitTransaction).not.toHaveBeenCalled();
  });
});
