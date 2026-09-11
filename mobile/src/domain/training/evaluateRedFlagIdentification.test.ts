import { describe, expect, it } from 'vitest';

import { redFlagIdentificationCatalog } from '@/data/redFlagIdentificationCatalog';
import { evaluateRedFlagIdentification } from './evaluateRedFlagIdentification';

describe('evaluateRedFlagIdentification', () => {
  it('returns correct when all expected red flags are selected with no false positives', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-fake-airdrop-page');
    if (!exercise) throw new Error('Expected exercise.');

    const result = evaluateRedFlagIdentification(exercise, { selectedRedFlagIds: [...exercise.expectedRedFlagIds] });

    expect(result.isCorrect).toBe(true);
    expect(result.redFlagIdentification?.selectedCorrectCount).toBe(exercise.expectedRedFlagIds.length);
    expect(result.redFlagIdentification?.missedCount).toBe(0);
    expect(result.redFlagIdentification?.falsePositiveCount).toBe(0);
    expect(result.redFlagIdentification?.accuracyPercent).toBe(100);
  });

  it('returns incorrect when a red flag is missed', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-social-impersonation');
    if (!exercise) throw new Error('Expected exercise.');

    const partial = exercise.expectedRedFlagIds.slice(0, exercise.expectedRedFlagIds.length - 1);
    const result = evaluateRedFlagIdentification(exercise, { selectedRedFlagIds: partial });

    expect(result.isCorrect).toBe(false);
    expect(result.redFlagIdentification?.missedCount).toBe(1);
  });

  it('returns incorrect when false positives are selected', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-defi-migration-mixed');
    if (!exercise) throw new Error('Expected exercise.');

    const result = evaluateRedFlagIdentification(exercise, { selectedRedFlagIds: [...exercise.expectedRedFlagIds, 'migration-1'] });

    expect(result.isCorrect).toBe(false);
    expect(result.redFlagIdentification?.falsePositiveCount).toBe(1);
  });

  it('computes multiple missed flags and deterministic counts', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-fake-support-dm');
    if (!exercise) throw new Error('Expected exercise.');

    const result = evaluateRedFlagIdentification(exercise, { selectedRedFlagIds: ['support-3'] });

    expect(result.redFlagIdentification?.selectedCorrectCount).toBe(1);
    expect(result.redFlagIdentification?.missedCount).toBe(3);
    expect(result.redFlagIdentification?.falsePositiveCount).toBe(0);
    expect(result.redFlagIdentification?.accuracyPercent).toBe(25);
  });

  it('computes mixed correct and false positive accuracy correctly', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-nft-claim-scarcity');
    if (!exercise) throw new Error('Expected exercise.');

    const result = evaluateRedFlagIdentification(exercise, { selectedRedFlagIds: ['nft-1', 'nft-2', 'nft-4'] });

    expect(result.redFlagIdentification?.selectedCorrectCount).toBe(2);
    expect(result.redFlagIdentification?.missedCount).toBe(1);
    expect(result.redFlagIdentification?.falsePositiveCount).toBe(1);
    expect(result.redFlagIdentification?.accuracyPercent).toBe(50);
  });

  it('supports zero-red-flag exercises with empty selection', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-legit-wallet-notice');
    if (!exercise) throw new Error('Expected exercise.');

    const result = evaluateRedFlagIdentification(exercise, { selectedRedFlagIds: [] });

    expect(result.isCorrect).toBe(true);
    expect(result.redFlagIdentification?.accuracyPercent).toBe(100);
    expect(result.redFlagIdentification?.missedCount).toBe(0);
    expect(result.redFlagIdentification?.falsePositiveCount).toBe(0);
  });

  it('is deterministic for identical input', () => {
    const exercise = redFlagIdentificationCatalog.find((candidate) => candidate.id === 'redflag-fake-airdrop-page');
    if (!exercise) throw new Error('Expected exercise.');

    const answer = { selectedRedFlagIds: ['airdrop-1', 'airdrop-4'] };
    const first = evaluateRedFlagIdentification(exercise, answer);
    const second = evaluateRedFlagIdentification(exercise, answer);

    expect(first).toEqual(second);
  });
});
