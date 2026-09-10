import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { permissionChallengeCatalog } from '@/data/permissionChallengeCatalog';
import { PermissionChallengeView } from './PermissionChallengeView';

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

describe('PermissionChallengeView', () => {
  it('renders neutral pre-decision request facts and all three actions', () => {
    const exercise = permissionChallengeCatalog.find((candidate) => candidate.id === 'permission-wallet-connect-match');
    if (!exercise) throw new Error('Expected permission challenge exercise.');

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PermissionChallengeView exercise={exercise} disabled={false} onSelect={() => undefined} />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).toContain('APPLICATION');
    expect(text).toContain('DOMAIN');
    expect(text).toContain('REQUEST');
    expect(text).toContain('REQUESTED ACCESS');
    expect(text).toContain('CONTEXT');
    expect(text).toContain('ALLOW');
    expect(text).toContain('NEEDS REVIEW');
    expect(text).toContain('REJECT');
    expect(text).toContain(exercise.request.appName);
    expect(text).toContain(exercise.request.displayedDomain as string);
    expect(text).toContain(exercise.request.requestedOrigin as string);
  });

  it('does not leak the expected decision or post-decision explanation before selection', () => {
    const exercise = permissionChallengeCatalog.find((candidate) => candidate.id === 'permission-unexpected-message-signature');
    if (!exercise) throw new Error('Expected permission challenge exercise.');

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PermissionChallengeView exercise={exercise} disabled={false} onSelect={() => undefined} />);
    });

    const text = renderedText(renderer.toJSON());
    expect(text).not.toContain(exercise.expectedDecision);
    expect(text).not.toContain(exercise.explanation);
    if (exercise.ruleToRemember) expect(text).not.toContain(exercise.ruleToRemember);
    (exercise.postDecisionAnalysis.riskSignals ?? []).forEach((signal) => {
      expect(text).not.toContain(signal);
    });
    (exercise.postDecisionAnalysis.reassuringSignals ?? []).forEach((signal) => {
      expect(text).not.toContain(signal);
    });
  });
});
