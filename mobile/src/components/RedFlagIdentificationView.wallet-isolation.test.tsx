import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';

import { redFlagIdentificationCatalog } from '@/data/redFlagIdentificationCatalog';
import { RedFlagIdentificationView } from './RedFlagIdentificationView';

const walletServiceMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  signMessage: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  authorize: vi.fn(),
  reauthorize: vi.fn(),
  signTransactions: vi.fn(),
  signAndSendTransactions: vi.fn(),
  sendTransaction: vi.fn(),
  submitTransaction: vi.fn(),
}));

vi.mock('@/services/wallet/mobileWalletService', () => ({
  mobileWalletService: walletServiceMock,
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('./PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: string; onPress: () => void; disabled?: boolean }) =>
    React.createElement(
      'Pressable',
      { onPress, disabled, accessibilityLabel: 'Check answer button' },
      React.createElement('Text', null, children),
    ),
}));

describe('RedFlagIdentificationView wallet isolation', () => {
  it('render, selection, and check-answer stay local and never call wallet/native APIs', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-social-impersonation');
    if (!exercise) throw new Error('Expected exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<RedFlagIdentificationView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const presses = renderer.root.findAll((node) => String(node.type) === 'Pressable');
    const itemPresses = presses.filter((node) => String(node.props.accessibilityLabel ?? '').startsWith('Selectable item'));
    const checkAnswerPress = presses.find((node) => node.props.accessibilityLabel === 'Check answer button');
    if (!checkAnswerPress) throw new Error('Expected check answer button.');

    act(() => {
      itemPresses[0].props.onPress();
      itemPresses[1].props.onPress();
      checkAnswerPress.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessage).not.toHaveBeenCalled();
    expect(walletServiceMock.connect).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnect).not.toHaveBeenCalled();
    expect(walletServiceMock.authorize).not.toHaveBeenCalled();
    expect(walletServiceMock.reauthorize).not.toHaveBeenCalled();
    expect(walletServiceMock.signTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.signAndSendTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.sendTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.submitTransaction).not.toHaveBeenCalled();
  });
});
