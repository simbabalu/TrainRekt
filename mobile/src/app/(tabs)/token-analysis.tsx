import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { PageHeading } from '@/components/PageHeading';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TokenAnalysisInputCard } from '@/components/token-analysis/TokenAnalysisInputCard';
import { TokenAnalysisReportCard } from '@/components/token-analysis/TokenAnalysisReportCard';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { useTokenAnalysis } from '@/hooks/useTokenAnalysis';

const INVALID_SHARE_MESSAGE = "TrainRekt couldn't find a Solana token address in the shared content.";
const MULTIPLE_SHARE_MESSAGE = 'Multiple Solana addresses were found. Paste or enter the token mint you want to inspect.';
const MAX_CONSUMED_SHARE_EVENTS = 64;
const consumedShareEventOrder: string[] = [];
const consumedShareEventIds = new Set<string>();

function consumeShareEventId(eventId: string): boolean {
  if (consumedShareEventIds.has(eventId)) return false;
  consumedShareEventIds.add(eventId);
  consumedShareEventOrder.push(eventId);

  while (consumedShareEventOrder.length > MAX_CONSUMED_SHARE_EVENTS) {
    const oldest = consumedShareEventOrder.shift();
    if (oldest) consumedShareEventIds.delete(oldest);
  }

  return true;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function __resetTokenAnalysisShareStateForTests(): void {
  consumedShareEventOrder.length = 0;
  consumedShareEventIds.clear();
}

export default function TokenAnalysisScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mint?: string | string[];
    shareEventId?: string | string[];
    autoAnalyze?: string | string[];
    shareStatus?: string | string[];
  }>();
  const scrollRef = useRef<ScrollView>(null);
  const handledShareRouteKeyRef = useRef<string | null>(null);
  const [dismissedShareNoticeEventId, setDismissedShareNoticeEventId] = useState<string | null>(null);
  const {
    mintInput,
    setMintInput,
    deterministicStatus,
    aiStatus,
    report,
    coach,
    validationError,
    deterministicError,
    aiError,
    analyzeToken,
    explainWithAi,
    clearInput,
  } = useTokenAnalysis();

  const sharedMint = firstParam(params.mint)?.trim();
  const shareEventId = firstParam(params.shareEventId);
  const autoAnalyze = firstParam(params.autoAnalyze);
  const shareStatus = firstParam(params.shareStatus);
  const isResultState = deterministicStatus === 'ready' && report != null;
  const shouldShowInput = !isResultState;
  const inlineNotice = useMemo(() => {
    if (!shareEventId || dismissedShareNoticeEventId === shareEventId) return null;
    if (shareStatus === 'invalid') return INVALID_SHARE_MESSAGE;
    if (shareStatus === 'multiple') return MULTIPLE_SHARE_MESSAGE;
    return null;
  }, [dismissedShareNoticeEventId, shareEventId, shareStatus]);

  useEffect(() => {
    if (!shareEventId) return;

    const routeKey = `${shareEventId}:${shareStatus ?? ''}:${sharedMint ?? ''}:${autoAnalyze ?? ''}`;
    if (handledShareRouteKeyRef.current === routeKey) return;
    handledShareRouteKeyRef.current = routeKey;

    if (shareStatus === 'invalid' || shareStatus === 'multiple') return;

    if (!sharedMint) return;

    setMintInput(sharedMint);

    if (autoAnalyze === '1' && consumeShareEventId(shareEventId)) {
      void analyzeToken(sharedMint);
    }
  }, [analyzeToken, autoAnalyze, shareEventId, shareStatus, sharedMint, setMintInput]);

  function handleAnalyzeAnotherToken() {
    if (shareEventId) {
      setDismissedShareNoticeEventId(shareEventId);
    }
    clearInput();
  }

  function scrollToContentY(y: number) {
    scrollRef.current?.scrollTo({
      y: Math.max(y - Spacing.sm, 0),
      animated: true,
    });
  }

  return (
    <Screen ref={scrollRef}>
      <PageHeading
        eyebrow="TOKEN IDENTITY"
        title="Analyze token"
        subtitle="Deterministic code establishes the facts. AI explains the facts."
      />
      {shouldShowInput ? <TokenAnalysisInputCard
        mintInput={mintInput}
        onChangeMint={(value) => {
          if (shareEventId) {
            setDismissedShareNoticeEventId(shareEventId);
          }
          setMintInput(value);
        }}
        validationError={validationError}
        inlineNotice={inlineNotice}
        deterministicStatus={deterministicStatus}
        onAnalyze={() => {
          void analyzeToken();
        }}
        onClear={() => {
          if (shareEventId) {
            setDismissedShareNoticeEventId(shareEventId);
          }
          clearInput();
        }}
      /> : null}
      {isResultState && report ? (
        <>
          <PrimaryButton onPress={handleAnalyzeAnotherToken} variant="secondary">ANALYZE ANOTHER TOKEN</PrimaryButton>
          <TokenAnalysisReportCard
            key={`${report.mint}:${report.inspection.inspectedAtUtc}`}
            report={report}
            deterministicError={deterministicError}
            aiStatus={aiStatus}
            aiError={aiError}
            coach={coach}
            onExplainWithAi={() => {
              void explainWithAi();
            }}
            onStartTraining={(topic, exerciseId) => {
              router.push({
                pathname: '/train',
                params: {
                  mode: 'practice',
                  source: 'token-analysis',
                  topic,
                  exerciseId,
                },
              });
            }}
            onRequestScrollTo={scrollToContentY}
          />
        </>
      ) : null}
      {!report && deterministicError ? <Text style={{ color: Colors.negative, fontSize: Typography.small, lineHeight: TypographyLineHeight.small }}>{deterministicError}</Text> : null}
    </Screen>
  );
}
