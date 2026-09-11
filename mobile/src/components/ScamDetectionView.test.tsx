import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { scamDetectionCatalog } from '@/data/scamDetectionCatalog';
import { ScamDetectionView } from './ScamDetectionView';

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

describe('ScamDetectionView', () => {
  it('renders source context and observed facts before a decision', () => {
    const exercise = scamDetectionCatalog.find((candidate) => candidate.id === 'scam-lookalike-swap-domain');
    if (!exercise) throw new Error('Expected scam detection exercise.');

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ScamDetectionView exercise={exercise} disabled={false} onSelect={() => undefined} />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('SCENARIO');
    expect(text).toContain('OBSERVED FACTS');
    expect(text).toContain('Displayed domain');
    expect(text).toContain('Destination domain');
    expect(text).toContain('How would you classify this?');
  });

  it('does not leak answer key or post-decision explanation before selection', () => {
    const exercise = scamDetectionCatalog.find((candidate) => candidate.id === 'scam-ambiguous-analytics-request');
    if (!exercise) throw new Error('Expected scam detection exercise.');

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<ScamDetectionView exercise={exercise} disabled={false} onSelect={() => undefined} />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).not.toContain(exercise.expectedDecision);
    expect(text).not.toContain(exercise.explanation);
    exercise.postDecisionAnalysis.riskSignals?.forEach((signal) => {
      expect(text).not.toContain(signal.detail);
    });
    exercise.postDecisionAnalysis.reassuringSignals?.forEach((signal) => {
      expect(text).not.toContain(signal.detail);
    });
  });
});
