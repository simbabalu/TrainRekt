import { describe, expect, it } from 'vitest';

import type { WalletLessonProgress } from '@/types/progress';
import { getWalletLessonStatus } from './getWalletLessonStatus';

const exerciseId = 'wallet-lesson-frozen-account-state';

function progressEntry(overrides: Partial<WalletLessonProgress[string]> = {}): WalletLessonProgress[string] {
  return {
    passed: true,
    completedAt: '2026-09-11T10:00:00.000Z',
    ...overrides,
  };
}

describe('getWalletLessonStatus', () => {
  it('returns not-started without a matching attempt', () => {
    expect(getWalletLessonStatus({ exerciseId, walletLessonProgress: {} })).toBe('not-started');
    expect(getWalletLessonStatus({ exerciseId, walletLessonProgress: { 'other-exercise': progressEntry() } })).toBe('not-started');
  });

  it('derives passed and failed from the stored latest wallet lesson result', () => {
    expect(getWalletLessonStatus({ exerciseId, walletLessonProgress: { [exerciseId]: progressEntry({ passed: true }) } })).toBe('passed');
    expect(getWalletLessonStatus({ exerciseId, walletLessonProgress: { [exerciseId]: progressEntry({ passed: false }) } })).toBe('failed');
  });

  it('treats eviction from recent history as non-authoritative for wallet status', () => {
    expect(getWalletLessonStatus({
      exerciseId,
      walletLessonProgress: { [exerciseId]: progressEntry({ passed: false, completedAt: '2026-09-11T11:00:00.000Z' }) },
    })).toBe('failed');
  });
});