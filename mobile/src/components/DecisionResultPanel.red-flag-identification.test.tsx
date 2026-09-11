import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { DecisionResultPanel } from './DecisionResultPanel';
import { TrainingExerciseResult } from '@/types/exercise';

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('./SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => children,
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

describe('DecisionResultPanel red-flag-identification', () => {
  it('renders structured post-answer feedback for red flag identification results', () => {
    const result: TrainingExerciseResult = {
      isCorrect: false,
      xpEarned: 30,
      title: 'Needs more precision',
      explanation: 'Review each observable item and focus on trust-boundary mismatches.',
      learningPoints: ['Inspect each item independently'],
      redFlagIdentification: {
        selectedCorrectCount: 2,
        missedCount: 1,
        falsePositiveCount: 1,
        accuracyPercent: 50,
        correctRedFlags: [{ id: 'rf-1', kind: 'domain', label: 'Domain mismatch', detail: 'Destination differs from official domain.' }],
        missedRedFlags: [{ id: 'rf-2', kind: 'urgency', label: 'Urgent timer', detail: 'Short countdown pressure.' }],
        falsePositives: [{ id: 'rf-3', kind: 'other', label: 'Brand color update', detail: 'Visual style alone is not a risk signal.' }],
        ruleToRemember: 'Prioritize origin and permission scope over visuals.',
      },
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<DecisionResultPanel result={result} skill="walletSafety" />);
    });

    const text = renderedText(renderer.toJSON()).replace(/\s+/g, ' ');
    expect(text).toContain('RED FLAG IDENTIFICATION');
    expect(text).toContain('Accuracy: 50 %');
    expect(text).toContain('CORRECT RED FLAGS');
    expect(text).toContain('MISSED RED FLAGS');
    expect(text).toContain('FALSE POSITIVES');
    expect(text).toContain('Domain mismatch');
    expect(text).toContain('Urgent timer');
    expect(text).toContain('Brand color update');
  });

  it('labels reduced practice exercise rewards without changing the awarded amount', () => {
    const result: TrainingExerciseResult = {
      isCorrect: true,
      xpEarned: 30,
      title: 'Correct',
      explanation: 'Good decision.',
    };

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<DecisionResultPanel result={result} skill="walletSafety" mode="practice" />);
    });

    const text = renderedText(renderer.toJSON()).replace(/\s+/g, ' ');
    expect(/\+\s*30 XP/.test(text)).toBe(true);
    expect(text).toContain('PRACTICE XP');
    expect(text).not.toContain('+120 XP');
  });
});
