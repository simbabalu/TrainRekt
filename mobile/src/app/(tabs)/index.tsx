import { Link, type Href } from 'expo-router';

import { DailyGoalCard } from '@/components/DailyGoalCard';
import { LevelProgressCard } from '@/components/LevelProgressCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TokenSafetyCheckCard } from '@/components/TokenSafetyCheckCard';
import { HomeWalletSafetyCard } from '@/components/wallet/HomeWalletSafetyCard';
import { calculateDailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { getHomeTrainingCta } from '@/domain/training/getHomeTrainingCta';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

export default function HomeScreen() {
  const { progress } = useTrainingProgress();
  const dailyGoalProgress = calculateDailyGoalProgress(progress.daily);
  const trainingCta = getHomeTrainingCta(dailyGoalProgress);

  return (
    <Screen>
      <LevelProgressCard summary={progress} totalXp={progress.totalXp} showTotalXp={false} dailyStreak={progress.daily.dailyTrainingStreak} />
      <DailyGoalCard goalProgress={dailyGoalProgress} dailyTrainingStreak={progress.daily.dailyTrainingStreak} />
      <Link href={{ pathname: '/train', params: { mode: trainingCta.mode } } as Href} asChild>
        <PrimaryButton variant={trainingCta.mode === 'practice' ? 'secondary' : 'primary'} onPress={() => undefined}>{trainingCta.label}</PrimaryButton>
      </Link>
      <TokenSafetyCheckCard />
      <HomeWalletSafetyCard />
    </Screen>
  );
}