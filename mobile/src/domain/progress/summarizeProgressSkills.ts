import { skillLabels } from '@/constants/training';
import type { HistoryEntry, SkillKey, SkillScores } from '@/types/progress';

const skillKeys: SkillKey[] = [
  'riskManagement',
  'profitTaking',
  'fomoResistance',
  'positionSizing',
  'scamAwareness',
  'leverageRisk',
  'panicSelling',
  'marketInterpretation',
  'walletSafety',
];

const defaultSkillPrior = 50;

export interface SkillCoverageEntry {
  skill: SkillKey;
  label: string;
  score: number;
  trained: boolean;
}

export interface ProgressSkillSummary {
  allSkills: SkillCoverageEntry[];
  trainedSkills: SkillCoverageEntry[];
  untrainedSkills: SkillCoverageEntry[];
  strongestSkills: SkillCoverageEntry[];
  needsPracticeSkills: SkillCoverageEntry[];
}

export function summarizeProgressSkills(
  skillScores: SkillScores,
  recentTrainingHistory: readonly HistoryEntry[],
): ProgressSkillSummary {
  const trainedByHistory = new Set(recentTrainingHistory.map((entry) => entry.skill));
  const allSkills = skillKeys.map((skill): SkillCoverageEntry => {
    const score = skillScores[skill];
    const trained = trainedByHistory.has(skill) || score !== defaultSkillPrior;
    return {
      skill,
      label: skillLabels[skill],
      score,
      trained,
    };
  });

  const orderIndex = new Map(allSkills.map((entry, index) => [entry.skill, index]));
  const trainedSkills = allSkills.filter((entry) => entry.trained);
  const untrainedSkills = allSkills.filter((entry) => !entry.trained);

  const strongestSkills = [...trainedSkills]
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return (orderIndex.get(first.skill) ?? 0) - (orderIndex.get(second.skill) ?? 0);
    })
    .slice(0, 2);

  const strongestSet = new Set(strongestSkills.map((entry) => entry.skill));
  const needsPracticeSkills = [...trainedSkills]
    .filter((entry) => !strongestSet.has(entry.skill))
    .sort((first, second) => {
      if (first.score !== second.score) return first.score - second.score;
      return (orderIndex.get(first.skill) ?? 0) - (orderIndex.get(second.skill) ?? 0);
    })
    .slice(0, 1);

  return {
    allSkills,
    trainedSkills,
    untrainedSkills,
    strongestSkills,
    needsPracticeSkills,
  };
}
