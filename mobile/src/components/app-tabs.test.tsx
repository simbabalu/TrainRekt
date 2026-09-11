import { act, create } from 'react-test-renderer';
import { View } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import AppTabs from './app-tabs';

vi.mock('expo-router/ui', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <TabsRoot>{children}</TabsRoot>,
  TabList: ({ children }: { children: React.ReactNode }) => <TabListRoot>{children}</TabListRoot>,
  TabSlot: () => null,
  TabTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

function TabsRoot({ children }: { children: React.ReactNode }) { return <View>{children}</View>; }
function TabListRoot({ children }: { children: React.ReactNode }) { return <View>{children}</View>; }

vi.mock('expo-router', () => ({}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
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

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

describe('AppTabs', () => {
  it('renders all four labeled tabs with stable icon triggers', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AppTabs />);
    });
    const text = renderedText(renderer.toJSON());
    const icons = renderer.root.findAll((node) => String(node.type) === 'SymbolView');

    expect(text).toContain('Home');
    expect(text).toContain('Train');
    expect(text).toContain('Progress');
    expect(text).toContain('Settings');
    expect(text).not.toContain('Wallet Safety');
    expect(icons).toHaveLength(4);
  });
});
