import { createContext, PropsWithChildren, useContext, useEffect } from 'react';

import { SurpriseChallengeModal } from '@/components/SurpriseChallengeModal';
import { surpriseChallengeCatalog } from '@/data/surpriseChallengeCatalog';
import { useSurpriseChallengeEngine } from '@/hooks/useSurpriseChallengeEngine';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { useWallet } from '@/hooks/useWallet';

function isDevRuntime() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

interface SurpriseChallengeContextValue {
  startPreview: (challengeId: string) => boolean;
}

const SurpriseChallengeContext = createContext<SurpriseChallengeContextValue | null>(null);

export function SurpriseChallengeProvider({ children }: PropsWithChildren) {
  const { status } = useWallet();
  const { isHydrated, progress, recordSurpriseChallengeCompletion } = useTrainingProgress();

  useEffect(() => {
    if (!isDevRuntime()) return;
    console.log('[SURPRISE] provider mounted');
  }, []);

  const engine = useSurpriseChallengeEngine({
    challenges: surpriseChallengeCatalog,
    walletStatus: status,
    progress: progress.surpriseChallenges,
    isHydrated,
    onComplete: recordSurpriseChallengeCompletion,
  });

  useEffect(() => {
    if (!isDevRuntime()) return;
    console.log(`[SURPRISE] modal host active=${String(Boolean(engine.activeSession))}`);
  }, [engine.activeSession]);

  return (
    <SurpriseChallengeContext.Provider value={{ startPreview: engine.startPreview }}>
      {children}
      <SurpriseChallengeModal
        session={engine.activeSession}
        onChooseDecision={engine.chooseDecision}
        onCloseReveal={engine.dismissReveal}
      />
    </SurpriseChallengeContext.Provider>
  );
}

export function useSurpriseChallengeContext() {
  const context = useContext(SurpriseChallengeContext);
  if (!context) throw new Error('useSurpriseChallengeContext must be used within SurpriseChallengeProvider');
  return context;
}
