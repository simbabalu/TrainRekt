import { describe, expect, it } from 'vitest';

import { permissionChallengeCatalog } from '@/data/permissionChallengeCatalog';
import { evaluatePermissionChallenge } from './evaluatePermissionChallenge';

const allowExercise = permissionChallengeCatalog.find((exercise) => exercise.expectedDecision === 'allow')!;
const rejectExercise = permissionChallengeCatalog.find((exercise) => exercise.expectedDecision === 'reject')!;
const reviewExercise = permissionChallengeCatalog.find((exercise) => exercise.expectedDecision === 'needs-review')!;

describe('evaluatePermissionChallenge', () => {
  it('marks allow as correct when expected', () => {
    const result = evaluatePermissionChallenge(allowExercise, 'allow');
    expect(result.isCorrect).toBe(true);
    expect(result.xpEarned).toBe(allowExercise.xpReward);
  });

  it('marks reject as correct when expected', () => {
    const result = evaluatePermissionChallenge(rejectExercise, 'reject');
    expect(result.isCorrect).toBe(true);
    expect(result.title).toBe('Good decision');
  });

  it('marks needs-review as correct when expected', () => {
    const result = evaluatePermissionChallenge(reviewExercise, 'needs-review');
    expect(result.isCorrect).toBe(true);
    expect(result.permissionChallenge?.permissionType).toBe(reviewExercise.request.permissionType);
  });

  it('marks incorrect answers and returns structured analysis payload', () => {
    const result = evaluatePermissionChallenge(rejectExercise, 'allow');
    expect(result).toMatchObject({
      isCorrect: false,
      xpEarned: 30,
      explanation: rejectExercise.explanation,
      learningPoints: rejectExercise.learningPoints,
      permissionChallenge: {
        appName: rejectExercise.request.appName,
      },
    });
  });
});
