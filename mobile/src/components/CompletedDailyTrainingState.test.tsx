import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { CompletedDailyTrainingState } from './CompletedDailyTrainingState';

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./AppIcon', () => ({ AppIcon: () => null }));
vi.mock('./SectionCard', () => ({ SectionCard: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('./PrimaryButton', () => ({ PrimaryButton: ({ children }: { children: React.ReactNode }) => React.createElement('Text', null, children) }));

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return text(value.children);
  return '';
}

describe('CompletedDailyTrainingState', () => {
  it('renders persisted completion without an exercise or award action', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<CompletedDailyTrainingState goalProgress={{ completed: 3, goal: 3, percentage: 100, isComplete: true }} dailyTrainingStreak={4} />);
    });
    const rendered = text(renderer.toJSON());
    expect(rendered).toContain("TODAY'S TRAINING COMPLETE");
    expect(rendered).toMatch(/3\s+\/\s+3/);
    expect(rendered.replace(/\s+/g, ' ')).toContain('+ 150 XP');
    expect(rendered).not.toContain('100%');
    expect(rendered).toContain('EXTRA PRACTICE');
    expect(rendered).not.toContain('Decision');
  });
});