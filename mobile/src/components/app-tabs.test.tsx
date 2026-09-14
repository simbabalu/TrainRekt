import { act, create } from 'react-test-renderer';
import { View } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import AppTabs from './app-tabs';

vi.mock('expo-router/ui', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <TabsRoot>{children}</TabsRoot>,
  TabList: ({ children }: { children: React.ReactNode }) => <TabListRoot>{children}</TabListRoot>,
  TabSlot: () => null,
  TabTrigger: ({ children, name, href }: { children: React.ReactNode; name: string; href: string }) => <TabTriggerRoot name={name} href={href}>{children}</TabTriggerRoot>,
}));

function TabsRoot({ children }: { children: React.ReactNode }) { return <View>{children}</View>; }
function TabListRoot({ children }: { children: React.ReactNode }) { return <View>{children}</View>; }
function TabTriggerRoot({ children, name, href }: { children: React.ReactNode; name: string; href: string }) { return <View accessibilityLabel={`${name}:${href}`}>{children}</View>; }

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

  it('exposes the normal app destinations from every shell route, including Wallet Safety', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AppTabs />);
    });

    const destinations = renderer.root.findAll((node) => String(node.type) === 'View' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.includes(':'))
      .map((node) => node.props.accessibilityLabel);
    expect(destinations).toEqual([
      'home:/',
      'train:/train',
      'progress:/explore',
      'settings:/settings',
      'wallet-safety:/wallet-safety',
      'token-analysis:/(tabs)/token-analysis',
    ]);
  });

  it('registers Wallet Safety in the shell without adding a visible navigation item', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AppTabs />);
    });

    const hiddenRoutes = renderer.root.findAll((node) => String(node.type) === 'Pressable' && node.props.style?.display === 'none');
    expect(hiddenRoutes).toHaveLength(2);
    hiddenRoutes.forEach((route) => {
      expect(route.props.accessibilityElementsHidden).toBe(true);
      expect(route.props.importantForAccessibility).toBe('no-hide-descendants');
    });
  });
});
