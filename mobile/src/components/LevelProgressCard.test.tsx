import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { LevelProgressCard } from './LevelProgressCard';

vi.mock('./SectionCard', () => ({ SectionCard: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('./ProgressBar', () => ({ ProgressBar: ({ label, percentage }: { label: string; percentage: number }) => React.createElement('Text', null, `${label} ${percentage}%`) }));
vi.mock('./AppIcon', () => ({ AppIcon: ({ accessibilityLabel }: { accessibilityLabel: string }) => React.createElement('Text', null, accessibilityLabel) }));
vi.mock('react-native', () => ({ StyleSheet: { create: (styles: unknown) => styles }, Text: 'Text', View: 'View' }));

const summary = {
  level: 7,
  xpIntoCurrentLevel: 742,
  xpRequiredForNextLevel: 1000,
  xpToNextLevel: 258,
  progressPercentage: 74.2,
  winRate: 74,
};

function textFrom(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textFrom).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return textFrom(value.children);
  return '';
}

describe('LevelProgressCard Home presentation', () => {
  it('shows streak and current-level progress without lifetime XP when configured for Home', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<LevelProgressCard summary={summary} totalXp={6742} showTotalXp={false} dailyStreak={0} />);
    });

    const text = textFrom(renderer.toJSON());
    expect(text).toMatch(/Level\s+7/);
    expect(text).toMatch(/0\s+days/);
    expect(text).toContain('742 / 1000 XP');
    expect(text).toContain('74.2%');
    expect(text).toMatch(/258\s+XP to Level\s+8/);
    expect(text).not.toContain('6742 XP total');
  });
});