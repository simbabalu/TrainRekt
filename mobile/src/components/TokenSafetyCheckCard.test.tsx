import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { TokenSafetyCheckCard } from './TokenSafetyCheckCard';

const pushMock = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => React.createElement('Pressable', { onPress }, React.createElement('Text', null, children)),
}));

vi.mock('@/components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

describe('TokenSafetyCheckCard', () => {
  it('renders the token safety action and routes to token analysis', () => {
    pushMock.mockReset();

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TokenSafetyCheckCard />);
    });

    const text = renderer.root.findAll((node) => String(node.type) === 'Text').map((node) => String(node.props.children ?? '')).join(' ');
    expect(text).toContain('TOKEN SAFETY CHECK');
    expect(text).toContain('Analyze any Solana token before you interact with it.');
    expect(text).toContain('ANALYZE TOKEN');

    const button = renderer.root.find((node) => String(node.type) === 'Pressable');
    act(() => {
      button.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith('/(tabs)/token-analysis');
  });
});