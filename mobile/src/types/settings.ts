export const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'] as const;

export type TrainingDifficulty = (typeof difficultyOptions)[number];

export interface TrainingSettings {
  difficulty: TrainingDifficulty;
  notificationsEnabled: boolean;
  soundEffectsEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  homeTourSeenVersion: number;
}