import { describe, expect, it } from 'vitest';

import { exerciseCatalog } from '@/data/exerciseCatalog';
import { permissionChallengeCatalog } from '@/data/permissionChallengeCatalog';
import { redFlagIdentificationCatalog } from '@/data/redFlagIdentificationCatalog';
import { scamDetectionCatalog } from '@/data/scamDetectionCatalog';
import { scenarioCatalog } from '@/data/scenarioCatalog';
import { signatureSimulationCatalog } from '@/data/signatureSimulationCatalog';
import { transactionInspectionCatalog } from '@/data/transactionInspectionCatalog';

describe('exerciseCatalog', () => {
  it('has the expected total and per-type counts in the runtime catalog', () => {
    const decisions = exerciseCatalog.filter((exercise) => exercise.type === 'decision');
    const signatures = exerciseCatalog.filter((exercise) => exercise.type === 'signature-simulation');
    const inspections = exerciseCatalog.filter((exercise) => exercise.type === 'transaction-inspection');
    const permissionChallenges = exerciseCatalog.filter((exercise) => exercise.type === 'permission-challenge');
    const scamDetections = exerciseCatalog.filter((exercise) => exercise.type === 'scam-detection');
    const redFlagExercises = exerciseCatalog.filter((exercise) => exercise.type === 'red-flag-identification');

    expect(exerciseCatalog).toHaveLength(41);
    expect(decisions).toHaveLength(12);
    expect(signatures).toHaveLength(4);
    expect(inspections).toHaveLength(5);
    expect(permissionChallenges).toHaveLength(6);
    expect(scamDetections).toHaveLength(8);
    expect(redFlagExercises).toHaveLength(6);
  });

  it('contains all decision exercises with type: decision', () => {
    const decisions = exerciseCatalog.filter((exercise) => exercise.type === 'decision');
    expect(decisions).toHaveLength(scenarioCatalog.length);
    decisions.forEach((decision, index) => {
      expect(decision.id).toBe(scenarioCatalog[index].id);
      expect(decision.title).toBe(scenarioCatalog[index].title);
    });
  });

  it('contains all signature exercises with type: signature-simulation', () => {
    const signatures = exerciseCatalog.filter((exercise) => exercise.type === 'signature-simulation');
    expect(signatures).toHaveLength(signatureSimulationCatalog.length);
    signatures.forEach((signature, index) => {
      expect(signature.id).toBe(signatureSimulationCatalog[index].id);
      expect(signature.skill).toBe('walletSafety');
    });
  });

  it('contains all transaction inspection exercises with type: transaction-inspection', () => {
    const inspections = exerciseCatalog.filter((exercise) => exercise.type === 'transaction-inspection');
    expect(inspections).toHaveLength(transactionInspectionCatalog.length);
    const runtimeIds = new Set(inspections.map((exercise) => exercise.id));
    expect(runtimeIds).toEqual(new Set(transactionInspectionCatalog.map((exercise) => exercise.id)));
    inspections.forEach((inspection, index) => {
      expect(inspection.id).toBe(transactionInspectionCatalog[index].id);
      expect(inspection.skill).toBe('walletSafety');
    });
  });

  it('contains all permission challenge exercises with type: permission-challenge', () => {
    const permissionChallenges = exerciseCatalog.filter((exercise) => exercise.type === 'permission-challenge');
    expect(permissionChallenges).toHaveLength(permissionChallengeCatalog.length);
    const runtimeIds = new Set(permissionChallenges.map((exercise) => exercise.id));
    expect(runtimeIds).toEqual(new Set(permissionChallengeCatalog.map((exercise) => exercise.id)));
    permissionChallenges.forEach((exercise, index) => {
      expect(exercise.id).toBe(permissionChallengeCatalog[index].id);
      expect(exercise.skill).toBe('walletSafety');
    });
  });

  it('contains all scam detection exercises with type: scam-detection', () => {
    const scamDetections = exerciseCatalog.filter((exercise) => exercise.type === 'scam-detection');
    expect(scamDetections).toHaveLength(scamDetectionCatalog.length);
    const runtimeIds = new Set(scamDetections.map((exercise) => exercise.id));
    expect(runtimeIds).toEqual(new Set(scamDetectionCatalog.map((exercise) => exercise.id)));
    scamDetections.forEach((exercise, index) => {
      expect(exercise.id).toBe(scamDetectionCatalog[index].id);
      expect(exercise.skill).toBe('walletSafety');
    });
  });

  it('contains all red flag identification exercises with type: red-flag-identification', () => {
    const redFlagExercises = exerciseCatalog.filter((exercise) => exercise.type === 'red-flag-identification');
    expect(redFlagExercises).toHaveLength(redFlagIdentificationCatalog.length);
    const runtimeIds = new Set(redFlagExercises.map((exercise) => exercise.id));
    expect(runtimeIds).toEqual(new Set(redFlagIdentificationCatalog.map((exercise) => exercise.id)));
    redFlagExercises.forEach((exercise, index) => {
      expect(exercise.id).toBe(redFlagIdentificationCatalog[index].id);
      expect(exercise.skill).toBe('walletSafety');
    });
  });

  it('has unique IDs across all exercise types', () => {
    const allIds = exerciseCatalog.map((exercise) => exercise.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('validates every decision exercise has required fields', () => {
    const decisions = exerciseCatalog.filter((exercise) => exercise.type === 'decision');
    decisions.forEach((exercise) => {
      expect(exercise).toHaveProperty('title');
      expect(exercise).toHaveProperty('skill');
      expect(exercise).toHaveProperty('difficulty');
      expect(exercise).toHaveProperty('xpReward');
      expect(exercise).toHaveProperty('description');
      expect(exercise.difficulty).toMatch(/Beginner|Intermediate|Advanced/);
    });
  });

  it('validates every signature exercise has required fields and learning content', () => {
    const signatures = exerciseCatalog.filter((exercise) => exercise.type === 'signature-simulation');
    signatures.forEach((exercise) => {
      expect(exercise).toHaveProperty('title');
      expect(exercise).toHaveProperty('skill');
      expect(exercise).toHaveProperty('difficulty');
      expect(exercise).toHaveProperty('xpReward');
      expect(exercise).toHaveProperty('description');
      expect(exercise).toHaveProperty('expectedDecision');
      expect(['sign', 'reject']).toContain(exercise.expectedDecision);
      expect(exercise).toHaveProperty('displayedActions');
      expect(exercise.displayedActions.length).toBeGreaterThan(0);
      expect(exercise).toHaveProperty('learningPoints');
      expect(exercise.learningPoints.length).toBeGreaterThan(0);
    });
  });

  it('validates every transaction inspection exercise has required transaction facts and no empty analysis source', () => {
    const inspections = exerciseCatalog.filter((exercise) => exercise.type === 'transaction-inspection');
    inspections.forEach((exercise) => {
      expect(exercise).toHaveProperty('title');
      expect(exercise).toHaveProperty('skill');
      expect(exercise).toHaveProperty('difficulty');
      expect(exercise).toHaveProperty('xpReward');
      expect(exercise).toHaveProperty('description');
      expect(exercise).toHaveProperty('expectedDecision');
      expect(['approve', 'reject', 'needs-review']).toContain(exercise.expectedDecision);
      expect(exercise.transaction.instructions.length).toBeGreaterThan(0);
      expect(exercise.transaction.programInvocations.length).toBeGreaterThan(0);
      expect(exercise.learningPoints.length).toBeGreaterThan(0);
    });
  });

  it('validates every permission challenge has typed request facts and post-decision analysis', () => {
    const permissionChallenges = exerciseCatalog.filter((exercise) => exercise.type === 'permission-challenge');
    permissionChallenges.forEach((exercise) => {
      expect(exercise).toHaveProperty('title');
      expect(exercise).toHaveProperty('skill');
      expect(exercise).toHaveProperty('difficulty');
      expect(exercise).toHaveProperty('xpReward');
      expect(exercise).toHaveProperty('description');
      expect(['allow', 'reject', 'needs-review']).toContain(exercise.expectedDecision);
      expect(exercise.request.permissions.length).toBeGreaterThan(0);
      expect(exercise.learningPoints.length).toBeGreaterThan(0);
      expect(exercise.postDecisionAnalysis).toBeDefined();
    });
  });

  it('validates every scam detection exercise has neutral facts and typed analysis', () => {
    const scamDetections = exerciseCatalog.filter((exercise) => exercise.type === 'scam-detection');
    scamDetections.forEach((exercise) => {
      expect(exercise).toHaveProperty('title');
      expect(exercise).toHaveProperty('skill');
      expect(exercise).toHaveProperty('difficulty');
      expect(exercise).toHaveProperty('xpReward');
      expect(exercise).toHaveProperty('description');
      expect(['safe', 'suspicious', 'scam']).toContain(exercise.expectedDecision);
      expect(exercise.scenario.neutralFacts.length).toBeGreaterThan(0);
      expect(exercise.postDecisionAnalysis).toBeDefined();
      expect(exercise.learningPoints.length).toBeGreaterThan(0);
    });
  });

  it('validates every red flag exercise has valid expected IDs and observable items', () => {
    const redFlagExercises = exerciseCatalog.filter((exercise) => exercise.type === 'red-flag-identification');
    redFlagExercises.forEach((exercise) => {
      expect(exercise.scenario.observableItems.length).toBeGreaterThan(0);
      const observableIds = new Set(exercise.scenario.observableItems.map((item) => item.id));
      exercise.expectedRedFlagIds.forEach((id) => {
        expect(observableIds.has(id)).toBe(true);
      });
    });
  });

  it('enforces red flag difficulty mix and pedagogical variety', () => {
    const redFlagExercises = exerciseCatalog.filter((exercise) => exercise.type === 'red-flag-identification');
    expect(redFlagExercises.filter((exercise) => exercise.difficulty === 'Beginner')).toHaveLength(2);
    expect(redFlagExercises.filter((exercise) => exercise.difficulty === 'Intermediate')).toHaveLength(2);
    expect(redFlagExercises.filter((exercise) => exercise.difficulty === 'Advanced')).toHaveLength(2);

    expect(redFlagExercises.some((exercise) => exercise.expectedRedFlagIds.length === 0)).toBe(true);
    expect(redFlagExercises.some((exercise) => exercise.expectedRedFlagIds.length < exercise.scenario.observableItems.length)).toBe(true);
  });
});
