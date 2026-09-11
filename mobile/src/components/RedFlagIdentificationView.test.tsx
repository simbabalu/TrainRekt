import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';

import { redFlagIdentificationCatalog } from '@/data/redFlagIdentificationCatalog';
import { RedFlagIdentificationView } from './RedFlagIdentificationView';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));

vi.mock('./PrimaryButton', () => ({
  PrimaryButton: ({ children, onPress, disabled }: { children: string; onPress: () => void; disabled?: boolean }) =>
    React.createElement(
      'Pressable',
      { onPress, disabled, accessibilityLabel: 'Check answer button' },
      React.createElement('Text', null, children),
    ),
}));

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (value && typeof value === 'object' && 'children' in value) return renderedText(value.children);
  return '';
}

function getItemPress(renderer: ReturnType<typeof create>, label: string) {
  return renderer.root.find((node) => node.props.accessibilityLabel === `Selectable item ${label}`);
}

function countCheckedMarkers(renderer: ReturnType<typeof create>) {
  return renderer.root
    .findAll((node) => String(node.type) === 'Text')
    .filter((node) => renderedText(node.props.children).trim() === '✓').length;
}

describe('RedFlagIdentificationView', () => {
  it('renders all observable items and keeps analysis content hidden before check answer', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-fake-airdrop-page');
    if (!exercise) throw new Error('Expected exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RedFlagIdentificationView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const text = renderedText(renderer.toJSON());
    exercise.scenario.observableItems.forEach((item) => {
      expect(text).toContain(item.label);
    });
    expect(text).not.toContain('CORRECT RED FLAGS');
    expect(text).not.toContain('MISSED RED FLAGS');
    expect(text).not.toContain('FALSE POSITIVES');
    if (exercise.ruleToRemember) {
      expect(text).not.toContain(exercise.ruleToRemember);
    }
    exercise.expectedRedFlagIds.forEach((id) => {
      expect(text).not.toContain(id);
    });
  });

  it('starts unchecked, toggles checked state on tap, and toggles off on second tap', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-fake-airdrop-page');
    if (!exercise) throw new Error('Expected exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RedFlagIdentificationView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const firstItemLabel = exercise.scenario.observableItems[0].label;

    let firstItem = getItemPress(renderer, firstItemLabel);
    expect(firstItem.props.accessibilityRole).toBe('checkbox');
    expect(firstItem.props.accessibilityState).toEqual({ checked: false, disabled: false });
    expect(countCheckedMarkers(renderer)).toBe(0);

    act(() => {
      firstItem.props.onPress();
    });

    firstItem = getItemPress(renderer, firstItemLabel);
    expect(firstItem.props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(countCheckedMarkers(renderer)).toBe(1);

    act(() => {
      firstItem.props.onPress();
    });

    firstItem = getItemPress(renderer, firstItemLabel);
    expect(firstItem.props.accessibilityState).toEqual({ checked: false, disabled: false });
    expect(countCheckedMarkers(renderer)).toBe(0);
    expect(onSelect).toHaveBeenCalledTimes(0);
  });

  it('supports selecting multiple items before check answer', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-fake-airdrop-page');
    if (!exercise) throw new Error('Expected exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RedFlagIdentificationView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const firstItem = exercise.scenario.observableItems[0];
    const thirdItem = exercise.scenario.observableItems[2];
    const checkAnswerPress = renderer.root.find((node) => node.props.accessibilityLabel === 'Check answer button');

    act(() => {
      getItemPress(renderer, firstItem.label).props.onPress();
      getItemPress(renderer, thirdItem.label).props.onPress();
    });

    expect(getItemPress(renderer, firstItem.label).props.accessibilityState.checked).toBe(true);
    expect(getItemPress(renderer, thirdItem.label).props.accessibilityState.checked).toBe(true);
    expect(countCheckedMarkers(renderer)).toBe(2);

    act(() => {
      checkAnswerPress.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith({ selectedRedFlagIds: [firstItem.id, thirdItem.id] });
  });

  it('supports zero-selection submission for zero-red-flag exercise', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-legit-wallet-notice');
    if (!exercise) throw new Error('Expected exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RedFlagIdentificationView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const presses = renderer.root.findAll((node) => String(node.type) === 'Pressable');
    const checkAnswerPress = presses.find((node) => node.props.accessibilityLabel === 'Check answer button');
    if (!checkAnswerPress) throw new Error('Expected check answer button.');
    act(() => {
      checkAnswerPress!.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith({ selectedRedFlagIds: [] });
  });

  it('locks item toggles and check answer when disabled', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-nft-claim-scarcity');
    if (!exercise) throw new Error('Expected exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RedFlagIdentificationView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const firstItem = exercise.scenario.observableItems[0];
    const secondItem = exercise.scenario.observableItems[1];
    let checkAnswerPress = renderer.root.find((node) => node.props.accessibilityLabel === 'Check answer button');

    act(() => {
      getItemPress(renderer, firstItem.label).props.onPress();
      checkAnswerPress.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.update(<RedFlagIdentificationView exercise={exercise} disabled onSelect={onSelect} />);
    });

    checkAnswerPress = renderer.root.find((node) => node.props.accessibilityLabel === 'Check answer button');
    const firstItemAfterDisable = getItemPress(renderer, firstItem.label);
    const secondItemAfterDisable = getItemPress(renderer, secondItem.label);
    expect(firstItemAfterDisable.props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(secondItemAfterDisable.props.accessibilityState).toEqual({ checked: false, disabled: true });

    act(() => {
      secondItemAfterDisable.props.onPress();
    });
    act(() => {
      checkAnswerPress.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(getItemPress(renderer, firstItem.label).props.accessibilityState).toEqual({ checked: true, disabled: true });
    expect(getItemPress(renderer, secondItem.label).props.accessibilityState).toEqual({ checked: false, disabled: true });
  });

  it('keeps selected-state visual and accessibility neutral, independent from correctness, before submit', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-fake-airdrop-page');
    if (!exercise) throw new Error('Expected exercise.');

    const onSelect = vi.fn();
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RedFlagIdentificationView exercise={exercise} disabled={false} onSelect={onSelect} />);
    });

    const expectedIdSet = new Set(exercise.expectedRedFlagIds);
    const correctItem = exercise.scenario.observableItems.find((item) => expectedIdSet.has(item.id));
    const incorrectItem = exercise.scenario.observableItems.find((item) => !expectedIdSet.has(item.id));
    if (!correctItem || !incorrectItem) throw new Error('Expected both a correct and incorrect selectable item.');

    act(() => {
      getItemPress(renderer, correctItem.label).props.onPress();
      getItemPress(renderer, incorrectItem.label).props.onPress();
    });

    expect(getItemPress(renderer, correctItem.label).props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(getItemPress(renderer, incorrectItem.label).props.accessibilityState).toEqual({ checked: true, disabled: false });
    expect(countCheckedMarkers(renderer)).toBe(2);

    const text = renderedText(renderer.toJSON());
    expect(text).not.toContain('CORRECT RED FLAGS');
    expect(text).not.toContain('MISSED RED FLAGS');
    expect(text).not.toContain('FALSE POSITIVES');
    if (exercise.ruleToRemember) {
      expect(text).not.toContain(exercise.ruleToRemember);
    }
    exercise.expectedRedFlagIds.forEach((id) => {
      expect(text).not.toContain(id);
    });
    expect(onSelect).toHaveBeenCalledTimes(0);
  });
});
