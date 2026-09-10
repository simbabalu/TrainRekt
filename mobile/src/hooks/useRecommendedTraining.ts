import { scenarioCatalog } from '@/data/scenarioCatalog';
import { selectAdaptiveScenario } from '@/domain/training/selectAdaptiveScenario';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

const stableRecommendationRandom = () => 0;

export function useRecommendedTraining(currentScenarioId?: string | null) {
  const { progress } = useTrainingProgress();
  const { settings } = useSettings();
  return selectAdaptiveScenario({ scenarios: scenarioCatalog, progress, difficulty: settings.difficulty, currentScenarioId }, stableRecommendationRandom);
}