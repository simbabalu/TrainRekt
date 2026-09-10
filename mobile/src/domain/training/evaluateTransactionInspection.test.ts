import { describe, expect, it } from 'vitest';

import { transactionInspectionCatalog } from '@/data/transactionInspectionCatalog';
import { evaluateTransactionInspection } from './evaluateTransactionInspection';

const approveExercise = transactionInspectionCatalog.find((exercise) => exercise.id === 'tx-normal-sol-transfer')!;
const rejectExercise = transactionInspectionCatalog.find((exercise) => exercise.id === 'tx-authority-control-change')!;
const reviewExercise = transactionInspectionCatalog.find((exercise) => exercise.id === 'tx-ambiguous-unfamiliar-flow')!;

describe('evaluateTransactionInspection', () => {
  it('marks approve as correct for a normal transfer exercise', () => {
    const result = evaluateTransactionInspection(approveExercise, 'approve');
    expect(result.isCorrect).toBe(true);
    expect(result.xpEarned).toBe(approveExercise.xpReward);
  });

  it('marks reject as correct for an authority-change exercise', () => {
    const result = evaluateTransactionInspection(rejectExercise, 'reject');
    expect(result.isCorrect).toBe(true);
    expect(result.title).toBe('Good decision');
  });

  it('marks needs-review as correct for an ambiguous exercise', () => {
    const result = evaluateTransactionInspection(reviewExercise, 'needs-review');
    expect(result.isCorrect).toBe(true);
    expect(result.transactionInspection?.network).toBe(reviewExercise.transaction.network);
  });

  it('returns structured analysis content for post-decision rendering', () => {
    const result = evaluateTransactionInspection(approveExercise, 'reject');
    expect(result).toMatchObject({
      isCorrect: false,
      xpEarned: 30,
      explanation: approveExercise.explanation,
      learningPoints: approveExercise.learningPoints,
      transactionInspection: {
        feeSol: approveExercise.transaction.feeSol,
      },
    });
    expect(result.transactionInspection?.instructions.length).toBeGreaterThan(0);
  });
});
