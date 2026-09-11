import { describe, expect, it } from 'vitest';

import { mockProgress } from '@/data/mockProgress';
import { exerciseCatalog } from '@/data/exerciseCatalog';
import { permissionChallengeCatalog } from '@/data/permissionChallengeCatalog';
import { signatureSimulationCatalog } from '@/data/signatureSimulationCatalog';
import { transactionInspectionCatalog } from '@/data/transactionInspectionCatalog';
import { calculateExerciseWeight, selectAdaptiveExercise } from './selectAdaptiveExercise';
import { TrainingProgressSnapshot } from '@/types/progress';
import { TrainingExercise } from '@/types/exercise';

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

    expect(['signature-simulation', 'transaction-inspection', 'permission-challenge', 'scam-detection']).toContain(exercise.type);
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

  it('can deterministically return a transaction-inspection exercise in the real catalog flow', () => {
    const progress = { ...snapshot, skillScores: { ...snapshot.skillScores, walletSafety: 0 }, recentTrainingHistory: [] };
    const currentExerciseId = signatureSimulationCatalog[0].id;
    const selected = selectAdaptiveExercise({ exercises: exerciseCatalog, progress, difficulty: 'Intermediate', currentExerciseId }, zeroRandom);

    expect(selected.type).toBe('transaction-inspection');
  });

  it('can deterministically return a permission-challenge exercise in the real catalog flow', () => {
    const permissionIdSet = new Set(permissionChallengeCatalog.map((exercise) => exercise.id));
    const progress = { ...snapshot, skillScores: { ...snapshot.skillScores, walletSafety: 0 }, recentTrainingHistory: [] };
    const currentExerciseId = signatureSimulationCatalog[0].id;
    const candidatePool = exerciseCatalog.filter((exercise) => exercise.id !== currentExerciseId);
    const sorted = candidatePool
      .map((exercise) => ({ exercise, weight: calculateExerciseWeight(exercise, { exercises: exerciseCatalog, progress, difficulty: 'Intermediate', currentExerciseId }) }))
      .sort((first, second) => second.weight - first.weight);
    const totalWeight = sorted.reduce((sum, entry) => sum + entry.weight, 0);
    const targetIndex = sorted.findIndex((entry) => permissionIdSet.has(entry.exercise.id));
    if (targetIndex === -1) throw new Error('Expected permission challenge candidate in weighted pool.');

    const cumulativeBefore = sorted.slice(0, targetIndex).reduce((sum, entry) => sum + entry.weight, 0);
    const targetWeight = sorted[targetIndex].weight;
    const randomValue = (cumulativeBefore + targetWeight / 2) / totalWeight;
    const selected = selectAdaptiveExercise({ exercises: exerciseCatalog, progress, difficulty: 'Intermediate', currentExerciseId }, () => randomValue);

    expect(selected.type).toBe('permission-challenge');
  });

  it('assigns finite positive weight to every eligible transaction-inspection exercise', () => {
    const progress = { ...snapshot, skillScores: { ...snapshot.skillScores, walletSafety: 0 }, recentTrainingHistory: [] };

    transactionInspectionCatalog.forEach((exercise) => {
      const weight = calculateExerciseWeight(exercise, { exercises: exerciseCatalog, progress, difficulty: 'Intermediate' });
      expect(Number.isFinite(weight)).toBe(true);
      expect(weight).toBeGreaterThan(0);
    });
  });

  it('keeps transaction-inspection selectable even with recent-history penalties', () => {
    const firstInspection = transactionInspectionCatalog[0];
    const recentHistory = [
      {
        id: 'h-tx-recent',
        scenarioId: firstInspection.id,
        scenarioTitle: firstInspection.title,
        correct: true,
        skill: firstInspection.skill,
        timestamp: '2026-01-01T00:00:00.000Z',
        xpEarned: 0,
        exerciseType: 'transaction-inspection' as const,
      },
    ];
    const progress = { ...snapshot, recentTrainingHistory: recentHistory, skillScores: { ...snapshot.skillScores, walletSafety: 0 } };
    const penalizedWeight = calculateExerciseWeight(firstInspection, { exercises: exerciseCatalog, progress, difficulty: 'Beginner' });

    expect(penalizedWeight).toBeGreaterThan(0);
    const selected = selectAdaptiveExercise({ exercises: exerciseCatalog, progress, difficulty: 'Beginner', currentExerciseId: firstInspection.id }, zeroRandom);
    expect(selected.id).not.toBe(firstInspection.id);
  });

  it('can select all five exercise types under controlled inputs', () => {
    const customExercises: TrainingExercise[] = [
      {
        id: 'decision-only-test',
        type: 'decision',
        title: 'Decision Test',
        skill: 'walletSafety',
        difficulty: 'Beginner',
        estimatedDuration: '~1 min',
        xpReward: 100,
        marketContext: { asset: 'SOL / USD' },
        description: 'Decision test exercise',
        question: 'Choose',
        options: [{ id: 'hold', label: 'HOLD' }],
        correctOptionId: 'hold',
        explanation: 'ok',
      },
      {
        id: 'signature-only-test',
        type: 'signature-simulation',
        title: 'Signature Test',
        skill: 'walletSafety',
        difficulty: 'Beginner',
        xpReward: 100,
        description: 'Signature test exercise',
        requestingApp: 'Test',
        requestType: 'message',
        displayedActions: [{ kind: 'summary', label: 'None' }],
        riskIndicators: [],
        safeIndicators: ['No transfers'],
        learningPoints: ['Inspect before sign'],
        expectedDecision: 'sign',
        explanation: 'ok',
      },
      {
        id: 'transaction-only-test',
        type: 'transaction-inspection',
        title: 'Transaction Test',
        skill: 'walletSafety',
        difficulty: 'Beginner',
        xpReward: 100,
        description: 'Transaction inspection test exercise',
        transaction: {
          network: 'solana-mainnet',
          feeSol: 0.00001,
          accountChanges: [],
          tokenTransfers: [],
          programInvocations: [{ program: 'System Program', verified: true }],
          instructions: [{ program: 'System Program', action: 'Transfer' }],
        },
        expectedDecision: 'approve',
        explanation: 'ok',
        learningPoints: ['Inspect instructions'],
      },
      {
        id: 'permission-only-test',
        type: 'permission-challenge',
        title: 'Permission Test',
        skill: 'walletSafety',
        difficulty: 'Beginner',
        xpReward: 100,
        description: 'Permission challenge test exercise',
        request: {
          appName: 'Test App',
          displayedDomain: 'test.example',
          requestedOrigin: 'test.example',
          permissionType: 'connect-wallet',
          permissions: [{ label: 'View address', detail: 'Read only', required: true, scope: 'session' }],
        },
        expectedDecision: 'allow',
        postDecisionAnalysis: { reassuringSignals: ['Minimal scope'] },
        explanation: 'ok',
        learningPoints: ['Check origin and scope'],
      },
      {
        id: 'scam-only-test',
        type: 'scam-detection',
        title: 'Scam Test',
        skill: 'walletSafety',
        difficulty: 'Beginner',
        xpReward: 100,
        description: 'Scam detection test exercise',
        scenario: {
          sourceType: 'website',
          senderOrApp: 'Test Source',
          neutralFacts: ['Observed fact'],
        },
        expectedDecision: 'suspicious',
        postDecisionAnalysis: { riskSignals: [{ label: 'Unclear context', detail: 'More verification needed' }] },
        explanation: 'ok',
        learningPoints: ['Pause and verify'],
      },
    ];
    const progress = { ...snapshot, skillScores: { ...snapshot.skillScores, walletSafety: 0 }, recentTrainingHistory: [] };

    expect(selectAdaptiveExercise({ exercises: customExercises, progress, difficulty: 'Beginner' }, () => 0).type).toBe('decision');
    expect(selectAdaptiveExercise({ exercises: customExercises, progress, difficulty: 'Beginner' }, () => 0.3).type).toBe('signature-simulation');
    expect(selectAdaptiveExercise({ exercises: customExercises, progress, difficulty: 'Beginner' }, () => 0.55).type).toBe('transaction-inspection');
    expect(selectAdaptiveExercise({ exercises: customExercises, progress, difficulty: 'Beginner' }, () => 0.8).type).toBe('permission-challenge');
    expect(selectAdaptiveExercise({ exercises: customExercises, progress, difficulty: 'Beginner' }, () => 0.95).type).toBe('scam-detection');
  });
});
