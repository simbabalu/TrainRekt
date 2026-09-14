import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';

import { parseSharedToken } from '@/domain/share/parseSharedToken';

const TOKEN_ANALYSIS_ROUTE = '/token-analysis';
const RECENT_EVENT_WINDOW_MS = 12_000;
const MAX_RECENT_EVENTS = 32;

const recentFingerprints: { fingerprint: string; observedAtMs: number }[] = [];
let shareEventSequence = 0;

function trimRecentFingerprints(nowMs: number): void {
  while (recentFingerprints.length > 0 && nowMs - recentFingerprints[0].observedAtMs > RECENT_EVENT_WINDOW_MS) {
    recentFingerprints.shift();
  }

  while (recentFingerprints.length > MAX_RECENT_EVENTS) {
    recentFingerprints.shift();
  }
}

function isDuplicateDelivery(fingerprint: string, nowMs: number): boolean {
  trimRecentFingerprints(nowMs);

  const duplicate = recentFingerprints.some((entry) => entry.fingerprint === fingerprint);
  if (duplicate) return true;

  recentFingerprints.push({ fingerprint, observedAtMs: nowMs });
  trimRecentFingerprints(nowMs);
  return false;
}

function nextShareEventId(nowMs: number): string {
  shareEventSequence += 1;
  return `share-${nowMs}-${shareEventSequence}`;
}

function asSafeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 12_000);
}

function buildFingerprint(payload: {
  text: string;
  webUrl: string;
  title: string;
  type: string;
}): string {
  return JSON.stringify(payload);
}

export function __resetShareIntentCoordinatorStateForTests(): void {
  recentFingerprints.length = 0;
  shareEventSequence = 0;
}

export function ShareIntentCoordinator() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (!hasShareIntent) return;

    const text = asSafeString(shareIntent.text);
    const webUrl = asSafeString(shareIntent.webUrl);
    const title = asSafeString(shareIntent.meta?.title);
    const type = asSafeString(shareIntent.type);

    const nowMs = Date.now();
    const fingerprint = buildFingerprint({ text, webUrl, title, type });
    if (isDuplicateDelivery(fingerprint, nowMs)) {
      resetShareIntent();
      return;
    }

    const parseResult = parseSharedToken({ text, webUrl, title });
    const shareEventId = nextShareEventId(nowMs);

    if (parseResult.kind === 'single') {
      router.push({
        pathname: TOKEN_ANALYSIS_ROUTE,
        params: {
          mint: parseResult.mint,
          shareEventId,
          autoAnalyze: '1',
        },
      });
      resetShareIntent();
      return;
    }

    if (parseResult.kind === 'multiple') {
      router.push({
        pathname: TOKEN_ANALYSIS_ROUTE,
        params: {
          shareEventId,
          shareStatus: 'multiple',
        },
      });
      resetShareIntent();
      return;
    }

    router.push({
      pathname: TOKEN_ANALYSIS_ROUTE,
      params: {
        shareEventId,
        shareStatus: 'invalid',
      },
    });
    resetShareIntent();
  }, [hasShareIntent, resetShareIntent, router, shareIntent]);

  return null;
}
