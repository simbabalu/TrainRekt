import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { WalletInspectionEducationDetails } from './WalletInspectionEducationDetails';

vi.mock('react-native', async () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

function flattenText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return flattenText(value.children);
  return '';
}

const summary = {
  reviewedTokenAccounts: 1,
  emptyTokenAccounts: 2,
  frozenTokenAccounts: 3,
  delegatedTokenAccounts: 4,
  token2022TokenAccounts: 5,
};

describe('WalletInspectionEducationDetails', () => {
  it('starts collapsed and reveals education plus technical counts when expanded', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<WalletInspectionEducationDetails summary={summary} />);
    });

    expect(flattenText(renderer.toJSON())).toContain('Learn how these signals work');
    expect(flattenText(renderer.toJSON())).not.toContain('WHY THIS MATTERS');
    expect(flattenText(renderer.toJSON())).not.toContain('TECHNICAL SIGNALS');

    const trigger = renderer.root.findAll((node) => String(node.type) === 'Pressable')[0];
    act(() => {
      trigger.props.onPress();
    });

    const expanded = flattenText(renderer.toJSON());
    expect(expanded).toContain('WHY THIS MATTERS');
    expect(expanded).toContain('REMEMBER');
    expect(expanded).toContain('TECHNICAL SIGNALS');
    expect(/Frozen:\s+3/.test(expanded)).toBe(true);
  });
});
