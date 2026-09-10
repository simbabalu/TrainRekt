import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { signatureSimulationCatalog } from '@/data/signatureSimulationCatalog';
import { SignatureSimulationView } from './SignatureSimulationView';

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

describe('SignatureSimulationView wallet isolation', () => {
  it('SIGN and REJECT stay local and never invoke wallet service', () => {
    const exercise = signatureSimulationCatalog.find((candidate) => candidate.type === 'signature-simulation');
    if (!exercise || exercise.type !== 'signature-simulation') {
      throw new Error('Expected signature simulation exercise.');
    }

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<SignatureSimulationView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const presses = renderer.root.findAll((node) => String(node.type) === 'Pressable');

    act(() => {
      presses[0].props.onPress();
      presses[1].props.onPress();
    });

    expect(onSelect).toHaveBeenNthCalledWith(1, 'reject');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'sign');
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
  });
});
