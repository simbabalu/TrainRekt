import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { PrimaryButton } from './PrimaryButton';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
}));

describe('PrimaryButton', () => {
  it('forwards its press handler to the native Pressable', () => {
    const onPress = vi.fn();
    let renderer: ReturnType<typeof create>;

    act(() => {
      renderer = create(<PrimaryButton onPress={onPress}>START TRAINING</PrimaryButton>);
    });

    act(() => {
      renderer.root.findAll((node) => String(node.type) === 'Pressable')[0].props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});