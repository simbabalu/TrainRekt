import { scenarioCatalog } from './scenarioCatalog';
import { signatureSimulationCatalog } from './signatureSimulationCatalog';
import { transactionInspectionCatalog } from './transactionInspectionCatalog';
import { TrainingExercise } from '@/types/exercise';

const decisionExercises: TrainingExercise[] = scenarioCatalog.map((scenario) => ({ ...scenario, type: 'decision' }));

export const exerciseCatalog: TrainingExercise[] = [
  ...decisionExercises,
  ...signatureSimulationCatalog,
  ...transactionInspectionCatalog,
];
