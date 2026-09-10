import { describe, expect, it } from 'vitest';

import { mockProgress } from '@/data/mockProgress';
import { scenarioCatalog } from '@/data/scenarioCatalog';
import { createProgressSnapshot } from '@/domain/progress/calculateLevel';
import { calculateScenarioWeight, selectAdaptiveScenario } from './selectAdaptiveScenario';
import { getWeakestSkills } from './getWeakestSkills';
import { TrainingDifficulty } from '@/types/settings';

const progress = createProgressSnapshot(mockProgress);
const fixedRandom = () => 0;
const focusedProgress = createProgressSnapshot({ ...mockProgress, skillScores: { ...mockProgress.skillScores, riskManagement: 90, profitTaking: 65, fomoResistance: 48, positionSizing: 90, scamAwareness: 90, leverageRisk: 90, panicSelling: 90, marketInterpretation: 90 } });

function selectWithDifficulty(difficulty: TrainingDifficulty) {
  return selectAdaptiveScenario({ scenarios: scenarioCatalog, progress, difficulty }, fixedRandom);
}

describe('adaptive scenario selection', () => {
  it('sorts weakest skills ascending by score', () => {
    const weakest = getWeakestSkills(progress.skillScores);
    expect(weakest[0]).toMatchObject({ skill: 'fomoResistance', score: 48 });
    expect(weakest[1]).toMatchObject({ skill: 'scamAwareness', score: 50 });
  });

  it('prioritizes the weakest skill with deterministic selection', () => {
    const scenario = selectAdaptiveScenario({ scenarios: scenarioCatalog, progress: focusedProgress, difficulty: 'Beginner' }, fixedRandom);
    expect(scenario.skill).toBe('fomoResistance');
  });

  it('reinforces a recent mistake skill without repeating its scenario', () => {
    const failedProgress = createProgressSnapshot({ ...focusedProgress, recentTrainingHistory: [{ ...mockProgress.recentTrainingHistory[0], scenarioId: 'memecoin-fomo', scenarioTitle: 'Memecoin FOMO', correct: false, skill: 'fomoResistance' }, ...mockProgress.recentTrainingHistory] });
    const scenario = selectAdaptiveScenario({ scenarios: scenarioCatalog, progress: failedProgress, difficulty: 'Intermediate', currentScenarioId: 'memecoin-fomo' }, fixedRandom);

    expect(scenario.skill).toBe('fomoResistance');
    expect(scenario.id).not.toBe('memecoin-fomo');
  });

  it('never immediately repeats when another scenario exists', () => {
    const scenario = selectAdaptiveScenario({ scenarios: scenarioCatalog, progress, difficulty: 'Intermediate', currentScenarioId: 'sol-momentum-trap' }, fixedRandom);
    expect(scenario.id).not.toBe('sol-momentum-trap');
  });

  it('penalizes scenarios used in recent history', () => {
    const recentScenario = scenarioCatalog.find((scenario) => scenario.id === 'sol-momentum-trap');
    const freshScenario = scenarioCatalog.find((scenario) => scenario.id === 'sol-second-entry');
    expect(recentScenario).toBeDefined();
    expect(freshScenario).toBeDefined();
    const recentProgress = createProgressSnapshot({ ...mockProgress, recentTrainingHistory: [{ ...mockProgress.recentTrainingHistory[0], scenarioId: 'sol-momentum-trap' }] });

    expect(calculateScenarioWeight(recentScenario!, { scenarios: scenarioCatalog, progress: recentProgress, difficulty: 'Intermediate' })).toBeLessThan(calculateScenarioWeight(freshScenario!, { scenarios: scenarioCatalog, progress: recentProgress, difficulty: 'Intermediate' }));
  });

  it.each<TrainingDifficulty>(['Beginner', 'Intermediate', 'Advanced'])('supports %s difficulty selection', (difficulty) => {
    const scenario = selectWithDifficulty(difficulty);
    expect(['Beginner', 'Intermediate', 'Advanced']).toContain(scenario.difficulty);
  });

  it('returns the only available scenario and handles empty history', () => {
    const onlyScenario = scenarioCatalog.slice(0, 1);
    const scenario = selectAdaptiveScenario({ scenarios: onlyScenario, progress: createProgressSnapshot({ ...mockProgress, recentTrainingHistory: [] }), difficulty: 'Beginner', currentScenarioId: onlyScenario[0].id }, fixedRandom);
    expect(scenario.id).toBe(onlyScenario[0].id);
  });

  it('produces the same recommendation for Home and Train inputs', () => {
    const input = { scenarios: scenarioCatalog, progress, difficulty: 'Intermediate' as const };
    expect(selectAdaptiveScenario(input, fixedRandom).id).toBe(selectAdaptiveScenario(input, fixedRandom).id);
  });
});
