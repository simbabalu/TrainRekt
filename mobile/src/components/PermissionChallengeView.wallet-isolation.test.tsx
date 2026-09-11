import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { permissionChallengeCatalog } from '@/data/permissionChallengeCatalog';
import { PermissionChallengeView } from './PermissionChallengeView';

const walletServiceMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  signMessage: vi.fn(),
}));

vi.mock('@/services/wallet/mobileWalletService', () => ({
  mobileWalletService: walletServiceMock,
}));

vi.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

describe('PermissionChallengeView wallet isolation', () => {
  it('actions stay local and never invoke wallet message signing', () => {
    const exercise = permissionChallengeCatalog.find((candidate) => candidate.id === 'permission-wallet-connect-match');
    if (!exercise) throw new Error('Expected permission challenge exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<PermissionChallengeView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const presses = renderer.root.findAll((node) => String(node.type) === 'Pressable');

    act(() => {
      presses[0].props.onPress();
      presses[1].props.onPress();
      presses[2].props.onPress();
    });

    expect(onSelect).toHaveBeenNthCalledWith(1, 'allow');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'needs-review');
    expect(onSelect).toHaveBeenNthCalledWith(3, 'reject');
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessage).not.toHaveBeenCalled();
  });
});
