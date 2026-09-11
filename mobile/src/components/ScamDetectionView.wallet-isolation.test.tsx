import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { scamDetectionCatalog } from '@/data/scamDetectionCatalog';
import { ScamDetectionView } from './ScamDetectionView';

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
  submitTransaction: vi.fn(),
  sendTransaction: vi.fn(),
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

describe('ScamDetectionView wallet isolation', () => {
  it('rendering and classification actions stay local and never invoke wallet/native APIs', () => {
    const exercise = scamDetectionCatalog.find((candidate) => candidate.id === 'scam-ambiguous-analytics-request');
    if (!exercise) throw new Error('Expected scam detection exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<ScamDetectionView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const presses = renderer.root.findAll((node) => String(node.type) === 'Pressable');

    act(() => {
      presses[0].props.onPress();
      presses[1].props.onPress();
      presses[2].props.onPress();
    });

    expect(onSelect).toHaveBeenNthCalledWith(1, 'safe');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'suspicious');
    expect(onSelect).toHaveBeenNthCalledWith(3, 'scam');

    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessage).not.toHaveBeenCalled();
    expect(walletServiceMock.connect).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnect).not.toHaveBeenCalled();
    expect(walletServiceMock.authorize).not.toHaveBeenCalled();
    expect(walletServiceMock.reauthorize).not.toHaveBeenCalled();
    expect(walletServiceMock.signTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.signAndSendTransactions).not.toHaveBeenCalled();
    expect(walletServiceMock.submitTransaction).not.toHaveBeenCalled();
    expect(walletServiceMock.sendTransaction).not.toHaveBeenCalled();
  });
});
