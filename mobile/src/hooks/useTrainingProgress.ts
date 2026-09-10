import { useContext } from 'react';

import { TrainingProgressContext } from '@/context/TrainingProgressContext';

export function useTrainingProgress() {
  const context = useContext(TrainingProgressContext);
  if (!context) {
    throw new Error('useTrainingProgress must be used within TrainingProgressProvider');
  }
  return context;
}