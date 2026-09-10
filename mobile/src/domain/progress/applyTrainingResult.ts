import { Training } from '@/constants/theme';
import { DecisionResult, TrainingScenario } from '@/types/scenario';
import { SkillScores, TrainingProgress } from '@/types/progress';

export interface TrainingCompletionMetadata {
  historyId: string;
  timestamp: string;
}

export function applyTrainingResult(
  progress: TrainingProgress,
  scenario: TrainingScenario,
  result: DecisionResult,
  metadata: TrainingCompletionMetadata,
): TrainingProgress {
  const currentStreak = result.isCorrect ? progress.currentStreak + 1 : 0;
  const updatedHistory = [{
    id: metadata.historyId,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    correct: result.isCorrect,
    skill: scenario.skill,
    timestamp: metadata.timestamp,
    xpEarned: result.xpEarned,
  }, ...progress.recentTrainingHistory].slice(0, Training.maxHistoryEntries);

  return {
    ...progress,
    totalXp: progress.totalXp + result.xpEarned,
    sessionsCompleted: progress.sessionsCompleted + 1,
    correctDecisions: progress.correctDecisions + (result.isCorrect ? 1 : 0),
    wrongDecisions: progress.wrongDecisions + (result.isCorrect ? 0 : 1),
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    skillScores: updateSkillScore(progress.skillScores, scenario.skill, result.isCorrect),
    recentTrainingHistory: updatedHistory,
  };
}

function updateSkillScore(scores: SkillScores, skill: keyof SkillScores, isCorrect: boolean): SkillScores {
  const change = isCorrect ? Training.correctSkillPoints : Training.incorrectSkillPoints;
  return { ...scores, [skill]: clampScore(scores[skill] + change) };
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}