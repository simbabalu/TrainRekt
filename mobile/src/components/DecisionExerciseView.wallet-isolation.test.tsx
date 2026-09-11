import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { scenarioCatalog } from '@/data/scenarioCatalog';
import { DecisionExerciseView } from './DecisionExerciseView';

const walletServiceMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
  signMessage: vi.fn(),
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

vi.mock('./ScenarioMarketCard', () => ({
  ScenarioMarketCard: () => null,
}));

describe('DecisionExerciseView wallet isolation', () => {
  it('decision choices stay local and never invoke wallet message signing', () => {
    const scenario = scenarioCatalog[0];

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <DecisionExerciseView
          exercise={{ ...scenario, type: 'decision' }}
          selectedAnswer={null}
          result={null}
          onSelect={onSelect}
        />,
      );
    });

    const presses = renderer.root.findAll((node) => String(node.type) === 'Pressable');

    act(() => {
      presses[0].props.onPress();
      presses[1].props.onPress();
    });

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(walletServiceMock.connectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.disconnectWallet).not.toHaveBeenCalled();
    expect(walletServiceMock.signMessage).not.toHaveBeenCalled();
  });
});
