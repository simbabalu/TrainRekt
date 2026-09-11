import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { Screen } from './Screen';

vi.mock('@/components/AppHeader', () => ({
  AppHeader: () => React.createElement('Text', null, 'APP_HEADER'),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

vi.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

describe('Screen', () => {
  it('renders the shared app header above scrollable screen content', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <Screen>
          <React.Fragment>
            <TextStub value="SCREEN_CONTENT" />
          </React.Fragment>
        </Screen>,
      );
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('APP_HEADER');
    expect(text).toContain('SCREEN_CONTENT');

    const safeAreaView = renderer.root.findAll((node) => String(node.type) === 'SafeAreaView')[0];
    expect(safeAreaView.props.edges).toEqual(['top']);
  });
});

function TextStub({ value }: { value: string }) {
  return React.createElement('Text', null, value);
}
