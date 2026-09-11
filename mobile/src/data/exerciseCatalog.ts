import { scenarioCatalog } from './scenarioCatalog';
import { signatureSimulationCatalog } from './signatureSimulationCatalog';
import { transactionInspectionCatalog } from './transactionInspectionCatalog';
import { permissionChallengeCatalog } from './permissionChallengeCatalog';
import { redFlagIdentificationCatalog } from './redFlagIdentificationCatalog';
import { scamDetectionCatalog } from './scamDetectionCatalog';
import { TrainingExercise } from '@/types/exercise';

const decisionExercises: TrainingExercise[] = scenarioCatalog.map((scenario) => ({ ...scenario, type: 'decision' }));

export const exerciseCatalog: TrainingExercise[] = [
  ...decisionExercises,
  ...signatureSimulationCatalog,
  ...transactionInspectionCatalog,
  ...permissionChallengeCatalog,
  ...scamDetectionCatalog,
  ...redFlagIdentificationCatalog,
];
