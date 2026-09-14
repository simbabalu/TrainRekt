import { Training } from '@/constants/theme';
import { applyDailyTrainingCompletion } from '@/domain/training/applyDailyTrainingCompletion';
import { TrainingExercise, TrainingExerciseResult } from '@/types/exercise';
import { SkillScores, TrainingProgress } from '@/types/progress';
import { TrainingMode } from '@/types/training';

export interface TrainingCompletionMetadata {
  historyId: string;
  timestamp: string;
  mode: TrainingMode;
  source?: 'adaptive' | 'wallet' | 'token-analysis';
}

export function applyTrainingResult(
  progress: TrainingProgress,
  exercise: TrainingExercise,
  result: TrainingExerciseResult,
  metadata: TrainingCompletionMetadata,
): TrainingProgress {
  const currentStreak = result.isCorrect ? progress.currentStreak + 1 : 0;
  const updatedHistory = [{
    id: metadata.historyId,
    scenarioId: exercise.id,
    scenarioTitle: exercise.title,
    correct: result.isCorrect,
    skill: exercise.skill,
    timestamp: metadata.timestamp,
    xpEarned: result.xpEarned,
    exerciseType: exercise.type,
  }, ...progress.recentTrainingHistory].slice(0, Training.maxHistoryEntries);
  const shouldClaimWalletReward = metadata.source === 'wallet'
    && !progress.walletLessonRewards.claimedExerciseIds.includes(exercise.id);
  const walletLessonRewards = shouldClaimWalletReward
    ? { claimedExerciseIds: [...progress.walletLessonRewards.claimedExerciseIds, exercise.id] }
    : progress.walletLessonRewards;
  const walletLessonProgress = metadata.source === 'wallet'
    ? {
      ...progress.walletLessonProgress,
      [exercise.id]: {
        passed: result.isCorrect,
        completedAt: metadata.timestamp,
      },
    }
    : progress.walletLessonProgress;

  const dailyResult = applyDailyTrainingCompletion(progress.daily, metadata.mode, new Date(metadata.timestamp));

  return {
    ...progress,
    totalXp: progress.totalXp + result.xpEarned + dailyResult.bonusXpAwarded,
    sessionsCompleted: progress.sessionsCompleted + 1,
    correctDecisions: progress.correctDecisions + (result.isCorrect ? 1 : 0),
    wrongDecisions: progress.wrongDecisions + (result.isCorrect ? 0 : 1),
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    skillScores: updateSkillScore(progress.skillScores, exercise.skill, result.isCorrect),
    recentTrainingHistory: updatedHistory,
    walletLessonRewards,
    walletLessonProgress,
    daily: dailyResult.daily,
  };
}

function updateSkillScore(scores: SkillScores, skill: keyof SkillScores, isCorrect: boolean): SkillScores {
  const change = isCorrect ? Training.correctSkillPoints : Training.incorrectSkillPoints;
  return { ...scores, [skill]: clampScore(scores[skill] + change) };
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}