import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import { evaluateSurpriseChallengeCompletion } from '@/domain/surprise/evaluateSurpriseChallengeCompletion';
import { SurpriseChallengeSession } from '@/hooks/useSurpriseChallengeEngine';
import { SurpriseChallengeModal } from './SurpriseChallengeModal';

vi.mock('react-native', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 24 }),
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

function renderedTreeText(renderer: ReturnType<typeof create>): string {
  return renderer.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => renderedText(node.props.children))
    .join(' ');
}

function makeSession(stage: SurpriseChallengeSession['stage'], firstDecision: 'reject' | 'inspect' | 'sign' = 'reject', finalDecision: 'reject' | 'sign' = 'reject'): SurpriseChallengeSession {
  const evaluation = stage === 'reveal'
    ? evaluateSurpriseChallengeCompletion(surpriseChallengeCatalog[0], firstDecision, finalDecision)
    : null;
  return {
    challenge: surpriseChallengeCatalog[0],
    stage,
    isPreview: false,
    countdownSecondsRemaining: 84,
    firstDecision: stage === 'reveal' ? firstDecision : null,
    finalDecision: stage === 'reveal' ? finalDecision : null,
    xpAwarded: evaluation?.xpAwarded ?? 0,
    badgeEarned: evaluation?.badgeEarned ?? false,
    outcomeTier: evaluation?.outcomeTier ?? null,
    evaluation,
  };
}

describe('SurpriseChallengeModal', () => {
  it('shows reward prompt actions without reveal leakage in initial state', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SurpriseChallengeModal
          session={makeSession('prompt')}
          onChooseDecision={vi.fn()}
          onCloseReveal={vi.fn()}
        />,
      );
    });

    const text = renderedTreeText(renderer);
    expect(text).toContain('CONGRATULATIONS');
    expect(text).toContain('SIGN');
    expect(text).toContain('INSPECT');
    expect(text).toContain('REJECT');
    expect(text).toContain('Eligibility expires in');
    expect(text).not.toContain('SECURITY SIMULATION');

    const actionButtons = renderer.root
      .findAll((node) => String(node.type) === 'Pressable')
      .filter((node) => String(node.props.accessibilityLabel ?? '').includes('surprise challenge action'));
    expect(actionButtons).toHaveLength(3);

    const style0 = actionButtons[0].props.style({ pressed: false });
    const style1 = actionButtons[1].props.style({ pressed: false });
    const style2 = actionButtons[2].props.style({ pressed: false });
    expect(style0).toEqual(style1);
    expect(style0).toEqual(style2);
  });

  it('shows neutral inspection details and keeps challenge active', () => {
    const onChooseDecision = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SurpriseChallengeModal
          session={makeSession('inspect')}
          onChooseDecision={onChooseDecision}
          onCloseReveal={vi.fn()}
        />,
      );
    });

    const text = renderedTreeText(renderer);
    expect(text).toContain('REQUEST ORIGIN');
    expect(text).toContain('REQUESTED ACTION');
    expect(text).toContain('EXPECTED?');
    expect(text).toContain('TRANSACTION?');
    expect(text).toContain('SIGN');
    expect(text).toContain('REJECT');
    expect(text).not.toContain('SECURITY SIMULATION');
  });

  it('shows an excellent direct rejection result before the learning details', () => {
    const onCloseReveal = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SurpriseChallengeModal
          session={makeSession('reveal')}
          onChooseDecision={vi.fn()}
          onCloseReveal={onCloseReveal}
        />,
      );
    });

    const text = renderedTreeText(renderer);
    expect(text).toContain('EXCELLENT DECISION');
    expect(text).toContain('You rejected the unexpected signing request immediately.');
    expect(text).toContain('SECURITY SIMULATION');
    expect(text).toMatch(/FIRST\s+REJECT/);
    expect(text).toMatch(/FINAL\s+REJECT/);
    expect(text).toMatch(/\+300 XP/);
    expect(text).toContain('BADGE EARNED');
    expect(text).toContain('Airdrop Survivor');
    expect(text.indexOf('EXCELLENT DECISION')).toBeLessThan(text.indexOf('WHY THIS MATTERED'));
    const continueButton = renderer.root.find((node) => node.props.accessibilityLabel === 'CONTINUE surprise challenge action');
    expect(String(continueButton.parent?.parent?.type)).toBe('View');
    expect(continueButton.parent?.parent?.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ paddingBottom: 36 })]));
    const scrollView = renderer.root.findAll((node) => String(node.type) === 'ScrollView')[0];
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: 24 })]),
    );
  });

  it('shows inspect then reject as a good decision with the valid inspection explanation', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SurpriseChallengeModal
          session={makeSession('reveal', 'inspect', 'reject')}
          onChooseDecision={vi.fn()}
          onCloseReveal={vi.fn()}
        />,
      );
    });

    const text = renderedTreeText(renderer);
    expect(text).toContain('GOOD DECISION');
    expect(text).toContain('You inspected the unexpected request before rejecting it.');
    expect(text).toContain('+250 XP');
    expect(text).toContain('Airdrop Survivor');
  });

  it('shows signing as a risky decision without an earned badge', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <SurpriseChallengeModal
          session={makeSession('reveal', 'sign', 'sign')}
          onChooseDecision={vi.fn()}
          onCloseReveal={vi.fn()}
        />,
      );
    });

    const text = renderedTreeText(renderer);
    expect(text).toContain('RISKY DECISION');
    expect(text).toContain('You chose to sign an unexpected request under artificial time pressure.');
    expect(text).toContain('+50 XP');
    expect(text).toContain('No badge earned this time');
    expect(text).not.toContain('BADGE EARNED');
  });
});
