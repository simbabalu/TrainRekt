import { Link, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, View } from 'react-native';

import { DailyGoalCard } from '@/components/DailyGoalCard';
import { HomeOnboardingTour, SpotlightRect } from '@/components/home/HomeOnboardingTour';
import { LevelProgressCard } from '@/components/LevelProgressCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TokenSafetyCheckCard } from '@/components/TokenSafetyCheckCard';
import { HomeWalletSafetyCard } from '@/components/wallet/HomeWalletSafetyCard';
import { calculateDailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { getHomeTrainingCta } from '@/domain/training/getHomeTrainingCta';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

type HomeTourTarget = 'daily' | 'token' | 'wallet';

const HOME_TOUR_VERSION = 1;
const homeTourTargets: Record<number, HomeTourTarget | null> = {
  0: null,
  1: 'token',
  2: 'wallet',
  3: 'daily',
};

export default function HomeScreen() {
  const { progress } = useTrainingProgress();
  const { settings, setHomeTourSeenVersion } = useSettings();

  const scrollRef = useRef<ScrollView>(null);
  const dailyTargetRef = useRef<View>(null);
  const tokenTargetRef = useRef<View>(null);
  const walletTargetRef = useRef<View>(null);
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [targetLayouts, setTargetLayouts] = useState<Partial<Record<HomeTourTarget, { y: number; height: number }>>>({});

  const dailyGoalProgress = calculateDailyGoalProgress(progress.daily);
  const trainingCta = getHomeTrainingCta(dailyGoalProgress);
  const tourVisible = settings.homeTourSeenVersion < HOME_TOUR_VERSION;

  const targetRefs = useMemo(
    () => ({ daily: dailyTargetRef, token: tokenTargetRef, wallet: walletTargetRef }),
    [],
  );

  useEffect(() => {
    if (!tourVisible) return;

    const target = homeTourTargets[tourStepIndex];
    if (!target) {
      return;
    }

    const layout = targetLayouts[target];
    const targetRef = targetRefs[target].current as unknown as { measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void } | null;
    const scrollNode = scrollRef.current as unknown as { scrollTo?: (options: { y: number; animated: boolean }) => void } | null;
    if (layout) {
      scrollNode?.scrollTo?.({ y: Math.max(layout.y - 24, 0), animated: true });
    }

    if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    measureTimerRef.current = setTimeout(() => {
      if (!targetRef?.measureInWindow) {
        setSpotlightRect(null);
        return;
      }

      targetRef.measureInWindow((x, y, width, height) => {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          setSpotlightRect(null);
          return;
        }
        setSpotlightRect({ x, y, width, height });
      });
    }, layout ? 280 : 0);

    return () => {
      if (measureTimerRef.current) {
        clearTimeout(measureTimerRef.current);
      }
    };
  }, [targetLayouts, targetRefs, tourStepIndex, tourVisible]);

  const registerTargetLayout = (target: HomeTourTarget) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setTargetLayouts((current) => ({ ...current, [target]: { y, height } }));
  };

  function closeTourAsSeen() {
    setHomeTourSeenVersion(HOME_TOUR_VERSION);
    setTourStepIndex(0);
    setSpotlightRect(null);
  }

  return (
    <Screen ref={scrollRef}>
      <LevelProgressCard summary={progress} totalXp={progress.totalXp} showTotalXp={false} dailyStreak={progress.daily.dailyTrainingStreak} />
      <View collapsable={false} onLayout={registerTargetLayout('daily')} ref={dailyTargetRef}>
        <DailyGoalCard goalProgress={dailyGoalProgress} dailyTrainingStreak={progress.daily.dailyTrainingStreak} />
        <Link href={{ pathname: '/train', params: { mode: trainingCta.mode } } as Href} asChild>
          <PrimaryButton variant={trainingCta.mode === 'practice' ? 'secondary' : 'primary'} onPress={() => undefined}>{trainingCta.label}</PrimaryButton>
        </Link>
      </View>
      <View collapsable={false} onLayout={registerTargetLayout('token')} ref={tokenTargetRef}>
        <TokenSafetyCheckCard />
      </View>
      <View collapsable={false} onLayout={registerTargetLayout('wallet')} ref={walletTargetRef}>
        <HomeWalletSafetyCard />
      </View>

      <HomeOnboardingTour
        onBack={() => setTourStepIndex((current) => Math.max(0, current - 1))}
        onNext={() => setTourStepIndex((current) => Math.min(3, current + 1))}
        onSkip={closeTourAsSeen}
        onFinish={closeTourAsSeen}
        spotlightRect={spotlightRect}
        stepIndex={tourStepIndex}
        visible={tourVisible}
      />
    </Screen>
  );
}