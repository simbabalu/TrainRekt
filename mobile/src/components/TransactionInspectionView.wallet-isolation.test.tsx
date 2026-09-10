import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { transactionInspectionCatalog } from '@/data/transactionInspectionCatalog';
import { TransactionInspectionView } from './TransactionInspectionView';

const walletServiceMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
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

describe('TransactionInspectionView wallet isolation', () => {
  it('decision buttons stay local and never invoke wallet service', () => {
    const exercise = transactionInspectionCatalog.find((candidate) => candidate.id === 'tx-normal-sol-transfer');
    if (!exercise) throw new Error('Expected transaction inspection exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TransactionInspectionView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const presses = renderer.root.findAll((node) => String(node.type) === 'Pressable');

    act(() => {
      presses[0].props.onPress();
      presses[1].props.onPress();
      presses[2].props.onPress();
    });

    expect(onSelect).toHaveBeenNthCalledWith(1, 'approve');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'needs-review');
    expect(onSelect).toHaveBeenNthCalledWith(3, 'reject');
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
  });
});
