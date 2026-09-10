import { describe, expect, it } from 'vitest';

import { exerciseCatalog } from '@/data/exerciseCatalog';
import { scenarioCatalog } from '@/data/scenarioCatalog';
import { signatureSimulationCatalog } from '@/data/signatureSimulationCatalog';
import { transactionInspectionCatalog } from '@/data/transactionInspectionCatalog';

describe('exerciseCatalog', () => {
  it('has the expected total and per-type counts in the runtime catalog', () => {
    const decisions = exerciseCatalog.filter((exercise) => exercise.type === 'decision');
    const signatures = exerciseCatalog.filter((exercise) => exercise.type === 'signature-simulation');
    const inspections = exerciseCatalog.filter((exercise) => exercise.type === 'transaction-inspection');

    expect(exerciseCatalog).toHaveLength(21);
    expect(decisions).toHaveLength(12);
    expect(signatures).toHaveLength(4);
    expect(inspections).toHaveLength(5);
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
});
