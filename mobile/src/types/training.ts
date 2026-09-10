export type TrainingMode = 'daily' | 'practice';

export function isTrainingMode(value: unknown): value is TrainingMode {
  return value === 'daily' || value === 'practice';
}
