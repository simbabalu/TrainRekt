import { scenarioCatalog } from './scenarioCatalog';
import { signatureSimulationCatalog } from './signatureSimulationCatalog';
import { TrainingExercise } from '@/types/exercise';

const decisionExercises: TrainingExercise[] = scenarioCatalog.map((scenario) => ({ ...scenario, type: 'decision' }));

export const exerciseCatalog: TrainingExercise[] = [...decisionExercises, ...signatureSimulationCatalog];
