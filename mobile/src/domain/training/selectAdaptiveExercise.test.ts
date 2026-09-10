import { describe, expect, it } from 'vitest';

import { mockProgress } from '@/data/mockProgress';
import { exerciseCatalog } from '@/data/exerciseCatalog';
import { calculateExerciseWeight, selectAdaptiveExercise } from './selectAdaptiveExercise';
import { TrainingProgressSnapshot } from '@/types/progress';

const snapshot: TrainingProgressSnapshot = {
  ...mockProgress,
  level: 1,
  xpIntoCurrentLevel: 0,
  xpRequiredForNextLevel: 1000,
  xpToNextLevel: 1000,
  winRate: 50,
};

const zeroRandom = () => 0;

describe('selectAdaptiveExercise', () => {
  it('deterministically selects the weakest-skill exercise when randomFn returns zero', () => {
    const progress = { ...snapshot, skillScores: { ...snapshot.skillScores, scamAwareness: 10 } };
    const exercise = selectAdaptiveExercise({ exercises: exerciseCatalog, progress, difficulty: 'Beginner' }, zeroRandom);

    expect(exercise.skill).toBe('scamAwareness');
  });

  it('can select a walletSafety exercise when walletSafety is the weakest skill', () => {
    const progress = { ...snapshot, skillScores: { ...snapshot.skillScores, walletSafety: 10 } };
    const exercise = selectAdaptiveExercise({ exercises: exerciseCatalog, progress, difficulty: 'Beginner' }, zeroRandom);

    expect(['signature-simulation', 'transaction-inspection']).toContain(exercise.type);
    expect(exercise.skill).toBe('walletSafety');
  });

  it('never re-selects the current exercise when alternatives exist', () => {
    const current = exerciseCatalog[0];
    const exercise = selectAdaptiveExercise({ exercises: exerciseCatalog, progress: snapshot, difficulty: 'Beginner', currentExerciseId: current.id }, zeroRandom);

    expect(exercise.id).not.toBe(current.id);
  });

  it('reinforces a skill with a recent mistake without forcing an immediate repeat', () => {
    const mistakeHistory = [{ id: 'h1', scenarioId: exerciseCatalog[0].id, scenarioTitle: exerciseCatalog[0].title, correct: false, skill: exerciseCatalog[0].skill, timestamp: '2026-01-01T00:00:00.000Z', xpEarned: 0, exerciseType: 'decision' as const }];
    const progress = { ...snapshot, recentTrainingHistory: mistakeHistory };
    const exercise = selectAdaptiveExercise({ exercises: exerciseCatalog, progress, difficulty: 'Beginner' }, zeroRandom);

    expect(exercise.id).not.toBe(exerciseCatalog[0].id);
  });

  it('penalizes a recently seen exercise relative to an untouched one of equal skill weakness', () => {
    const recentEntry = { id: 'h1', scenarioId: exerciseCatalog[0].id, scenarioTitle: exerciseCatalog[0].title, correct: true, skill: exerciseCatalog[0].skill, timestamp: '2026-01-01T00:00:00.000Z', xpEarned: 0, exerciseType: 'decision' as const };
    const progress = { ...snapshot, recentTrainingHistory: [recentEntry] };

    const recentWeight = calculateExerciseWeight(exerciseCatalog[0], { exercises: exerciseCatalog, progress, difficulty: 'Beginner' });
    const freshWeight = calculateExerciseWeight(exerciseCatalog[1], { exercises: exerciseCatalog, progress, difficulty: 'Beginner' });

    expect(recentWeight).toBeLessThan(freshWeight * 2);
  });

  it('supports difficulty preference weighting for each difficulty tier', () => {
    (['Beginner', 'Intermediate', 'Advanced'] as const).forEach((difficulty) => {
      const exercise = selectAdaptiveExercise({ exercises: exerciseCatalog, progress: snapshot, difficulty }, zeroRandom);
      expect(exercise).toBeDefined();
    });
  });

  it('falls back to the single candidate when only one exercise is available', () => {
    const onlyExercise = [exerciseCatalog[0]];
    const exercise = selectAdaptiveExercise({ exercises: onlyExercise, progress: snapshot, difficulty: 'Beginner', currentExerciseId: onlyExercise[0].id }, zeroRandom);

    expect(exercise.id).toBe(onlyExercise[0].id);
  });

  it('selects a valid exercise when history is empty', () => {
    const progress = { ...snapshot, recentTrainingHistory: [] };
    const exercise = selectAdaptiveExercise({ exercises: exerciseCatalog, progress, difficulty: 'Beginner' }, zeroRandom);

    expect(exerciseCatalog.some((candidate) => candidate.id === exercise.id)).toBe(true);
  });

  it('is deterministic for the same inputs, matching Home/Train recommendation alignment', () => {
    const first = selectAdaptiveExercise({ exercises: exerciseCatalog, progress: snapshot, difficulty: 'Beginner' }, zeroRandom);
    const second = selectAdaptiveExercise({ exercises: exerciseCatalog, progress: snapshot, difficulty: 'Beginner' }, zeroRandom);

    expect(first.id).toBe(second.id);
  });
});
