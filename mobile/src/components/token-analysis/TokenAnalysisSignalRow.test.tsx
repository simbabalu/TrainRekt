import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { TokenAnalysisSignalRow } from './TokenAnalysisSignalRow';
import { Colors } from '@/constants/theme';
import type { TokenAnalysisSignal } from '@/domain/token-analysis/tokenAnalysisSummary';

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('@/components/AppIcon', () => ({
  AppIcon: (props: Record<string, unknown>) => React.createElement('AppIcon', props),
}));

function signal(overrides: Partial<TokenAnalysisSignal> = {}): TokenAnalysisSignal {
  return {
    id: 'signal',
    icon: 'concentration',
    label: 'TOKEN PROGRAM',
    value: 'Token-2022',
    description: 'Ongoing inflationary issuance is documented, and the observed active mint authority is consistent with that model.',
    tone: 'informational',
    ...overrides,
  };
}

function styleValues(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(styleValues));
  return style && typeof style === 'object' ? style as Record<string, unknown> : {};
}

describe('TokenAnalysisSignalRow', () => {
  it('uses purple informational styling and an info icon', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TokenAnalysisSignalRow signal={signal()} />);
    });

    const icon = renderer.root.findByType(AppIcon);
    const label = renderer.root.findAllByType(Text)[0];

    expect(icon.props.name).toEqual({ ios: 'info.circle.fill', android: 'info', web: 'info' });
    expect(icon.props.tintColor).toBe(Colors.accent);
    expect(label.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: Colors.accent })]));
  });

  it('retains warning styling and a warning icon for review findings', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TokenAnalysisSignalRow signal={signal({ tone: 'review', icon: 'review', label: 'REVIEW' })} />);
    });

    const icon = renderer.root.findByType(AppIcon);
    const label = renderer.root.findAllByType(Text)[0];

    expect(icon.props.name).toEqual({ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' });
    expect(icon.props.tintColor).toBe(Colors.warning);
    expect(label.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: Colors.warning })]));
  });

  it('keeps the row and text content shrinkable for natural wrapping', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TokenAnalysisSignalRow signal={signal()} />);
    });

    const views = renderer.root.findAllByType(View);
    const textNodes = renderer.root.findAllByType(Text);

    expect(views.some((node) => styleValues(node.props.style).minWidth === 0)).toBe(true);
    expect(views.some((node) => {
      const styles = styleValues(node.props.style);
      return styles.flex === 1 && styles.minWidth === 0;
    })).toBe(true);
    expect(textNodes.every((node) => styleValues(node.props.style).flexShrink === 1)).toBe(true);
  });

  it('renders the full long informational description without line clamping or ellipsis props', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TokenAnalysisSignalRow signal={signal()} />);
    });

    const descriptionText = renderer.root.findAllByType(Text)
      .find((node) => node.props.children === signal().description);

    expect(descriptionText).toBeDefined();
    expect(descriptionText?.props.numberOfLines).toBeUndefined();
    expect(descriptionText?.props.ellipsizeMode).toBeUndefined();
  });
});