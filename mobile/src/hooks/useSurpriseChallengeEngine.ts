import * as React from 'react';

import { calculateSurpriseDelayMs } from '@/domain/surprise/calculateSurpriseDelayMs';
import {
  evaluateSurpriseChallengeCompletion,
  SurpriseChallengeEvaluation,
} from '@/domain/surprise/evaluateSurpriseChallengeCompletion';
import { selectEligibleSurpriseChallenges } from '@/domain/surprise/selectEligibleSurpriseChallenges';
import {
  SurpriseChallenge,
  SurpriseChallengeCompletionInput,
  SurpriseChallengeDecision,
  SurpriseChallengeFinalDecision,
  SurpriseChallengeProgress,
  SurpriseChallengeTrigger,
} from '@/types/surpriseChallenge';
import { WalletConnectionStatus } from '@/types/wallet';

function isDevRuntime() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

interface SurpriseChallengeEngineOptions {
  challenges: SurpriseChallenge[];
  walletStatus: WalletConnectionStatus;
  progress: SurpriseChallengeProgress;
  isHydrated: boolean;
  onComplete: (completion: SurpriseChallengeCompletionInput) => void;
  randomFn?: () => number;
  nowFn?: () => Date;
}

export interface SurpriseChallengeSession {
  challenge: SurpriseChallenge;
  stage: 'prompt' | 'inspect' | 'reveal';
  isPreview: boolean;
  countdownSecondsRemaining: number;
  firstDecision: SurpriseChallengeDecision | null;
  finalDecision: SurpriseChallengeFinalDecision | null;
  xpAwarded: number;
  badgeEarned: boolean;
  outcomeTier: 'preferred' | 'acceptable' | 'failed' | null;
  evaluation: SurpriseChallengeEvaluation | null;
}

interface SurpriseChallengeEngine {
  activeSession: SurpriseChallengeSession | null;
  chooseDecision: (decision: SurpriseChallengeDecision) => void;
  dismissReveal: () => void;
  startPreview: (challengeId: string) => boolean;
}

export function useSurpriseChallengeEngine({
  challenges,
  walletStatus,
  progress,
  isHydrated,
  onComplete,
  randomFn = Math.random,
  nowFn = () => new Date(),
}: SurpriseChallengeEngineOptions): SurpriseChallengeEngine {
  const [activeSession, setActiveSession] = React.useState<SurpriseChallengeSession | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const previousWalletStatusRef = React.useRef<WalletConnectionStatus>(walletStatus);
  const pendingWalletConnectedTriggerRef = React.useRef(false);
  const progressRef = React.useRef(progress);
  const completionCommitRef = React.useRef<Record<string, boolean>>({});

  function debugLog(message: string) {
    if (!isDevRuntime()) return;
    console.log(`[SURPRISE] ${message}`);
  }

  React.useEffect(() => {
    debugLog('engine mounted');
  }, []);

  React.useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  React.useEffect(() => {
    const committed: Record<string, boolean> = {};
    Object.keys(progress.completed).forEach((challengeId) => {
      committed[challengeId] = true;
    });
    completionCommitRef.current = committed;
  }, [progress]);

  const clearScheduledTimeout = React.useCallback(() => {
    if (!timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const clearCountdownInterval = React.useCallback(() => {
    if (!countdownIntervalRef.current) return;
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;
  }, []);

  const openChallenge = React.useCallback((challenge: SurpriseChallenge, isPreview: boolean) => {
    setActiveSession({
      challenge,
      stage: 'prompt',
      isPreview,
      countdownSecondsRemaining: Math.max(0, challenge.presentation.countdownSeconds ?? 0),
      firstDecision: null,
      finalDecision: null,
      xpAwarded: 0,
      badgeEarned: false,
      outcomeTier: null,
      evaluation: null,
    });
  }, []);

  const scheduleForTrigger = React.useCallback((trigger: SurpriseChallengeTrigger) => {
    if (!isHydrated) return;
    if (activeSession) return;
    if (timeoutRef.current) return;

    const eligible = selectEligibleSurpriseChallenges(challenges, trigger, progressRef.current);
    const completedCount = Object.keys(progressRef.current.completed).length;
    debugLog(`completed count=${completedCount}`);
    debugLog(`eligible count=${eligible.length}`);
    const nextChallenge = eligible[0];
    if (!nextChallenge) return;
    debugLog(`eligible challenge found id=${nextChallenge.id}`);

    const delayMs = calculateSurpriseDelayMs(nextChallenge.delay, randomFn());
    debugLog(`scheduling id=${nextChallenge.id} delay=${delayMs}`);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      debugLog(`timer fired id=${nextChallenge.id}`);
      if (progressRef.current.completed[nextChallenge.id]) return;
      openChallenge(nextChallenge, false);
      debugLog(`active challenge set id=${nextChallenge.id}`);
    }, delayMs);
  }, [activeSession, challenges, isHydrated, openChallenge, randomFn]);

  React.useEffect(() => {
    const previousStatus = previousWalletStatusRef.current;
    const wasConnected = previousStatus === 'connected';
    const isNowConnected = walletStatus === 'connected';
    const becameConnected = !wasConnected && isNowConnected;
    debugLog(`observe walletStatus=${walletStatus} hydrated=${String(isHydrated)}`);
    debugLog(`previousWalletStatus=${previousStatus}`);
    previousWalletStatusRef.current = walletStatus;

    if (walletStatus === 'disconnected') {
      pendingWalletConnectedTriggerRef.current = false;
    }

    if (!becameConnected) {
      return;
    }

    debugLog('transition disconnected->connected');
    if (!isHydrated) {
      pendingWalletConnectedTriggerRef.current = true;
      debugLog('queued wallet-connected trigger');
      return;
    }

    scheduleForTrigger('wallet-connected');
  }, [isHydrated, scheduleForTrigger, walletStatus]);

  React.useEffect(() => {
    if (!isHydrated) return;
    if (!pendingWalletConnectedTriggerRef.current) return;
    if (walletStatus !== 'connected') {
      pendingWalletConnectedTriggerRef.current = false;
      return;
    }
    debugLog('processing queued wallet-connected trigger');
    pendingWalletConnectedTriggerRef.current = false;
    scheduleForTrigger('wallet-connected');
  }, [isHydrated, scheduleForTrigger, walletStatus]);

  React.useEffect(() => {
    clearCountdownInterval();
    if (!activeSession) return;
    if (activeSession.stage === 'reveal') return;
    if (activeSession.countdownSecondsRemaining <= 0) return;

    countdownIntervalRef.current = setInterval(() => {
      setActiveSession((current) => {
        if (!current) return current;
        if (current.stage === 'reveal') return current;
        return {
          ...current,
          countdownSecondsRemaining: Math.max(0, current.countdownSecondsRemaining - 1),
        };
      });
    }, 1000);

    return () => {
      clearCountdownInterval();
    };
  }, [activeSession, clearCountdownInterval]);

  React.useEffect(() => {
    return () => {
      clearScheduledTimeout();
      clearCountdownInterval();
    };
  }, [clearCountdownInterval, clearScheduledTimeout]);

  const completeSession = React.useCallback((
    challenge: SurpriseChallenge,
    isPreview: boolean,
    firstDecision: SurpriseChallengeDecision,
    finalDecision: SurpriseChallengeFinalDecision,
  ) => {
    const evaluation = evaluateSurpriseChallengeCompletion(challenge, firstDecision, finalDecision);
    if (!isPreview && !completionCommitRef.current[challenge.id]) {
      completionCommitRef.current[challenge.id] = true;
      onComplete({
        challenge,
        firstDecision,
        finalDecision,
        xpAwarded: evaluation.xpAwarded,
        badgeEarned: evaluation.badgeEarned,
        completedAt: nowFn().toISOString(),
      });
    }

    setActiveSession((current) => {
      if (!current) return current;
      return {
        ...current,
        stage: 'reveal',
        firstDecision,
        finalDecision,
        xpAwarded: evaluation.xpAwarded,
        badgeEarned: evaluation.badgeEarned,
        outcomeTier: evaluation.outcomeTier,
        evaluation,
      };
    });
  }, [nowFn, onComplete]);

  const chooseDecision = React.useCallback((decision: SurpriseChallengeDecision) => {
    setActiveSession((current) => {
      if (!current) return current;
      if (current.stage === 'reveal') return current;

      if (decision === 'inspect') {
        if (!current.challenge.decisions.includes('inspect')) return current;
        if (current.stage === 'inspect') return current;
        return {
          ...current,
          stage: 'inspect',
          firstDecision: current.firstDecision ?? 'inspect',
        };
      }

      const finalDecision = decision;
      const firstDecision = current.firstDecision ?? decision;

      // Execute completion in a microtask-safe follow-up to avoid nested state updates.
      queueMicrotask(() => {
        completeSession(current.challenge, current.isPreview, firstDecision, finalDecision);
      });

      return current;
    });
  }, [completeSession]);

  const dismissReveal = React.useCallback(() => {
    setActiveSession((current) => {
      if (!current) return null;
      if (current.stage !== 'reveal') return current;
      return null;
    });
  }, []);

  const startPreview = React.useCallback((challengeId: string) => {
    if (!isDevRuntime()) return false;
    const challenge = challenges.find((candidate) => candidate.id === challengeId);
    if (!challenge) return false;
    clearScheduledTimeout();
    clearCountdownInterval();
    openChallenge(challenge, true);
    return true;
  }, [challenges, clearCountdownInterval, clearScheduledTimeout, openChallenge]);

  return {
    activeSession,
    chooseDecision,
    dismissReveal,
    startPreview,
  };
}
