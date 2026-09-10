import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { transactionInspectionCatalog } from '@/data/transactionInspectionCatalog';
import { TransactionInspectionView } from './TransactionInspectionView';

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

describe('TransactionInspectionView', () => {
  it('renders factual transaction details before a decision', () => {
    const exercise = transactionInspectionCatalog.find((candidate) => candidate.id === 'tx-unknown-program-unexpected-movement');
    if (!exercise) throw new Error('Expected transaction inspection exercise.');

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TransactionInspectionView exercise={exercise} disabled={false} onSelect={() => undefined} />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('REQUEST CONTEXT');
    expect(text).toContain('PROGRAMS INVOKED');
    expect(text).toContain('INSTRUCTION SUMMARY');
    expect(text).toContain('ASSET MOVEMENT');
    expect(text).toContain('ACCOUNT CHANGES');
    expect(text).toContain('Unknown Program 9xQa...r2');
    expect(text).toContain('Collection #128');
  });

  it('does not leak answer key or post-decision explanation before selection', () => {
    const exercise = transactionInspectionCatalog.find((candidate) => candidate.id === 'tx-ambiguous-unfamiliar-flow');
    if (!exercise) throw new Error('Expected transaction inspection exercise.');

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TransactionInspectionView exercise={exercise} disabled={false} onSelect={() => undefined} />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).not.toContain(exercise.expectedDecision);
    expect(text).not.toContain(exercise.explanation);
    if (exercise.ruleToRemember) expect(text).not.toContain(exercise.ruleToRemember);
  });
});
