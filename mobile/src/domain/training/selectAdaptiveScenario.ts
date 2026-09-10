import { getWeakestSkills } from './getWeakestSkills';
import { SkillKey, TrainingProgressSnapshot } from '@/types/progress';
import { TrainingDifficulty } from '@/types/settings';
import { TrainingScenario } from '@/types/scenario';

interface AdaptiveSelectionInput {
  scenarios: TrainingScenario[];
  progress: TrainingProgressSnapshot;
  difficulty: TrainingDifficulty;
  currentScenarioId?: string | null;
}

const difficultyPreference: Record<TrainingDifficulty, TrainingScenario['difficulty'][]> = {
  Beginner: ['Beginner', 'Intermediate', 'Advanced'],
  Intermediate: ['Intermediate', 'Beginner', 'Advanced'],
  Advanced: ['Advanced', 'Intermediate', 'Beginner'],
};

export function selectAdaptiveScenario(input: AdaptiveSelectionInput, randomFn: () => number = Math.random): TrainingScenario {
  const candidates = input.scenarios.filter((scenario) => scenario.id !== input.currentScenarioId);
  const pool = candidates.length > 0 ? candidates : input.scenarios;
  if (pool.length === 0) throw new Error('Cannot select a training scenario from an empty catalog.');

  const weakestSkills = getWeakestSkills(input.progress.skillScores);
  const weightedCandidates = pool.map((scenario) => ({ scenario, weight: calculateScenarioWeight(scenario, input, weakestSkills) })).sort((first, second) => second.weight - first.weight);
  const totalWeight = weightedCandidates.reduce((total, candidate) => total + candidate.weight, 0);
  if (totalWeight <= 0) return pool[0];

  let target = Math.min(0.999999, Math.max(0, randomFn())) * totalWeight;
  for (const candidate of weightedCandidates) {
    target -= candidate.weight;
    if (target <= 0) return candidate.scenario;
  }
  return weightedCandidates[weightedCandidates.length - 1].scenario;
}

export function calculateScenarioWeight(scenario: TrainingScenario, input: AdaptiveSelectionInput, weakestSkills = getWeakestSkills(input.progress.skillScores)): number {
  const weakestRank = weakestSkills.findIndex((entry) => entry.skill === scenario.skill);
  const skillScore = input.progress.skillScores[scenario.skill];
  const weaknessWeight = Math.max(1, (101 - skillScore) / 10);
  const skillPriorityWeight = weakestRank === -1 ? 1 : Math.max(1, weakestSkills.length - weakestRank);
  const difficultyWeight = difficultyPreference[input.difficulty].indexOf(scenario.difficulty) === 0 ? 3 : difficultyPreference[input.difficulty].indexOf(scenario.difficulty) === 1 ? 2 : 1;
  const recentEntries = input.progress.recentTrainingHistory.slice(0, 3);
  const recentMistakeBonus = recentEntries.some((entry) => !entry.correct && entry.skill === scenario.skill) ? 3 : 1;
  const recentScenarioPenalty = recentEntries.some((entry) => entry.scenarioId === scenario.id) ? 0.25 : 1;
  return weaknessWeight * skillPriorityWeight * difficultyWeight * recentMistakeBonus * recentScenarioPenalty;
}

export function getRecentMistakeSkills(progress: TrainingProgressSnapshot): SkillKey[] {
  return progress.recentTrainingHistory.filter((entry) => !entry.correct).slice(0, 3).map((entry) => entry.skill);
}