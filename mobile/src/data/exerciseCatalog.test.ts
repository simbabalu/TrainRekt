import { describe, expect, it } from 'vitest';

import { exerciseCatalog } from '@/data/exerciseCatalog';
import { scenarioCatalog } from '@/data/scenarioCatalog';
import { signatureSimulationCatalog } from '@/data/signatureSimulationCatalog';

describe('exerciseCatalog', () => {
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
      expect((exercise as any).displayedActions.length).toBeGreaterThan(0);
      expect(exercise).toHaveProperty('learningPoints');
      expect((exercise as any).learningPoints.length).toBeGreaterThan(0);
    });
  });
});
