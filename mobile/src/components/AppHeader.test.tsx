import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { AppHeader } from './AppHeader';

vi.mock('@/components/appHeaderLogo', () => ({
  appHeaderLogo: { testUri: 'trainrekt-adaptive-foreground.png' },
}));

vi.mock('@/components/WalletHeaderControl', () => ({
  WalletHeaderControl: () => React.createElement('WalletHeaderControl'),
}));

vi.mock('react-native', () => ({
  Image: 'Image',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

describe('AppHeader branding', () => {
  it('renders the transparent TrainRekt logo beside the existing title', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AppHeader />);
    });
    const logo = renderer.root.find((node) => String(node.type) === 'Image');
    const title = renderer.root.find((node) => String(node.type) === 'Text');

    expect(logo.props.accessibilityLabel).toBe('TrainRekt logo');
    expect(logo.props.source).toEqual({
      testUri: expect.stringContaining('trainrekt-adaptive-foreground.png'),
    });
    expect(logo.props.style).toEqual({ height: 42, width: 42 });
    expect(title.props.children).toBe('TRAINREKT');
  });
});