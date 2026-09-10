import { describe, expect, it } from 'vitest';

import { scenarioCatalog } from '@/data/scenarioCatalog';
import { SkillKey } from '@/types/progress';
import { selectNextScenarioIndex } from './selectNextScenario';

const validSkills: SkillKey[] = ['riskManagement', 'profitTaking', 'fomoResistance', 'positionSizing', 'scamAwareness', 'leverageRisk', 'panicSelling', 'marketInterpretation'];

describe('scenario catalog', () => {
  it('contains eight scenarios with unique IDs and valid options', () => {
    expect(scenarioCatalog).toHaveLength(8);
    expect(new Set(scenarioCatalog.map((scenario) => scenario.id)).size).toBe(scenarioCatalog.length);
    scenarioCatalog.forEach((scenario) => {
      expect(scenario.options.length).toBeGreaterThanOrEqual(2);
      expect(scenario.options.some((option) => option.id === scenario.correctOptionId)).toBe(true);
      expect(validSkills).toContain(scenario.skill);
    });
  });

  it('rotates deterministically without immediate repetition', () => {
    const nextIndex = selectNextScenarioIndex(0, scenarioCatalog.length);
    expect(nextIndex).toBe(1);
    expect(scenarioCatalog[nextIndex].id).not.toBe(scenarioCatalog[0].id);
    expect(selectNextScenarioIndex(scenarioCatalog.length - 1, scenarioCatalog.length)).toBe(0);
  });
});