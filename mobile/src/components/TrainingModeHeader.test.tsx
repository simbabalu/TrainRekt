import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { TrainingModeHeader } from './TrainingModeHeader';

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('./AppIcon', () => ({ AppIcon: () => null }));

vi.mock('./ProgressBar', () => ({
  ProgressBar: ({ label, percentage }: { label: string; percentage: number }) => React.createElement('Text', null, `${label} ${percentage}%`),
}));

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return text(value.children);
  return '';
}

describe('TrainingModeHeader', () => {
  it.each([
    [{ currentStep: 1, totalSteps: 3, percentage: 33, isComplete: false }, 'Decision 1 of 3 33%'],
    [{ currentStep: 2, totalSteps: 3, percentage: 67, isComplete: false }, 'Decision 2 of 3 67%'],
    [{ currentStep: 3, totalSteps: 3, percentage: 100, isComplete: false }, 'Decision 3 of 3 100%'],
  ])('uses current session step progress: %s', (step, expected) => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainingModeHeader mode="daily" step={step} />);
    });
    expect(text(renderer.toJSON())).toContain(expected);
  });

  it('shows completed-day header state at 100%', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<TrainingModeHeader mode="daily" step={{ currentStep: 3, totalSteps: 3, percentage: 100, isComplete: true }} />);
    });
    expect(text(renderer.toJSON())).toContain('3 / 3 COMPLETE 100%');
  });
});