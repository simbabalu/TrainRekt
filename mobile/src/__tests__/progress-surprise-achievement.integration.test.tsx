import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import ProgressScreen from '@/app/(tabs)/explore';
import { TrainingProgressProvider } from '@/context/TrainingProgressContext';
import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

const storage = vi.hoisted(() => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

vi.mock('@/components/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/PageHeading', () => ({ PageHeading: () => null }));
vi.mock('@/components/SectionCard', () => ({ SectionCard: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/LevelProgressCard', () => ({
  LevelProgressCard: () => React.createElement('Text', null, 'LEVEL CARD'),
}));
vi.mock('@/components/ProgressBar', () => ({
  ProgressBar: ({ label, percentage }: { label: string; percentage: number }) => React.createElement('Text', null, `${label} ${percentage}%`),
}));
vi.mock('@/components/AppIcon', () => ({ AppIcon: () => null }));
vi.mock('@/components/PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => React.createElement('Pressable', { onPress, disabled }, React.createElement('Text', null, children)),
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

describe('Progress surprise achievement integration', () => {
  it('renders Airdrop Survivor immediately after canonical progress badge update', async () => {
    let progressContext!: ReturnType<typeof useTrainingProgress>;

    function Harness() {
      progressContext = useTrainingProgress();
      return <ProgressScreen />;
    }

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<TrainingProgressProvider><Harness /></TrainingProgressProvider>);
      await Promise.resolve();
    });

    expect(renderedText(renderer.toJSON())).toContain('No achievements earned yet.');

    const challenge = surpriseChallengeCatalog[0];
    act(() => {
      progressContext.recordSurpriseChallengeCompletion({
        challenge,
        firstDecision: 'inspect',
        finalDecision: 'reject',
        xpAwarded: 250,
        badgeEarned: true,
        completedAt: '2026-09-11T12:00:00.000Z',
      });
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('Airdrop Survivor');
    expect(text).toContain('Completed the fake airdrop surprise challenge with a safe final rejection.');
  });
});
