import { describe, expect, it } from 'vitest';

import { exerciseCatalog } from '@/data/exerciseCatalog';
import { evaluateExercise } from './evaluateExercise';

describe('evaluateExercise', () => {
  it('routes signature-simulation exercises to signature evaluation', () => {
    const exercise = exerciseCatalog.find((candidate) => candidate.type === 'signature-simulation')!;
    const result = evaluateExercise(exercise, exercise.expectedDecision);
    expect(result.isCorrect).toBe(true);
  });

  it('routes transaction-inspection exercises to transaction inspection evaluation', () => {
    const exercise = exerciseCatalog.find((candidate) => candidate.type === 'transaction-inspection')!;
    const result = evaluateExercise(exercise, exercise.expectedDecision);
    expect(result.isCorrect).toBe(true);
    expect(result.transactionInspection).toBeDefined();
  });

  it('routes permission-challenge exercises to permission challenge evaluation', () => {
    const exercise = exerciseCatalog.find((candidate) => candidate.type === 'permission-challenge')!;
    const result = evaluateExercise(exercise, exercise.expectedDecision);
    expect(result.isCorrect).toBe(true);
    expect(result.permissionChallenge).toBeDefined();
  });

  it('routes scam-detection exercises to scam detection evaluation', () => {
    const exercise = exerciseCatalog.find((candidate) => candidate.type === 'scam-detection')!;
    const result = evaluateExercise(exercise, exercise.expectedDecision);
    expect(result.isCorrect).toBe(true);
    expect(result.scamDetection).toBeDefined();
  });

  it('routes decision exercises to scenario evaluation', () => {
    const exercise = exerciseCatalog.find((candidate) => candidate.type === 'decision')!;
    const result = evaluateExercise(exercise, exercise.correctOptionId);
    expect(result.isCorrect).toBe(true);
  });
});
