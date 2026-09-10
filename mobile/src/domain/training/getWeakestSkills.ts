import { SkillKey, SkillScores } from '@/types/progress';

export interface SkillPriority {
  skill: SkillKey;
  score: number;
}

export function getWeakestSkills(skillScores: SkillScores): SkillPriority[] {
  return (Object.entries(skillScores) as [SkillKey, number][])
    .map(([skill, score]) => ({ skill, score }))
    .sort((first, second) => first.score - second.score);
}