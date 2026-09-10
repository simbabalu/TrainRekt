import { describe, expect, it } from 'vitest';

import { signatureSimulationCatalog } from '@/data/signatureSimulationCatalog';
import { evaluateSignatureSimulation } from './evaluateSignatureSimulation';

const maliciousExercise = signatureSimulationCatalog.find((exercise) => exercise.id === 'malicious-authority-change')!;
const legitimateExercise = signatureSimulationCatalog.find((exercise) => exercise.id === 'legitimate-message-signature')!;

describe('evaluateSignatureSimulation', () => {
  it('treats signing a malicious request as incorrect', () => {
    const result = evaluateSignatureSimulation(maliciousExercise, 'sign');
    expect(result.isCorrect).toBe(false);
    expect(result.title).toBe('Dangerous decision');
  });

  it('treats rejecting a malicious request as correct', () => {
    const result = evaluateSignatureSimulation(maliciousExercise, 'reject');
    expect(result.isCorrect).toBe(true);
    expect(result.xpEarned).toBe(maliciousExercise.xpReward);
  });

  it('treats signing a legitimate request as correct', () => {
    const result = evaluateSignatureSimulation(legitimateExercise, 'sign');
    expect(result.isCorrect).toBe(true);
    expect(result.xpEarned).toBe(legitimateExercise.xpReward);
  });

  it('treats rejecting a legitimate request as incorrect', () => {
    const result = evaluateSignatureSimulation(legitimateExercise, 'reject');
    expect(result.isCorrect).toBe(false);
    expect(result.title).toBe('Risky decision');
  });

  it('always returns the common TrainingExerciseResult contract', () => {
    const result = evaluateSignatureSimulation(maliciousExercise, 'reject');
    expect(result).toMatchObject({
      isCorrect: expect.any(Boolean),
      xpEarned: expect.any(Number),
      title: expect.any(String),
      explanation: maliciousExercise.explanation,
      learningPoints: maliciousExercise.learningPoints,
    });
  });
});
