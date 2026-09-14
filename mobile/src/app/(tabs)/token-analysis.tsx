import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, Text } from 'react-native';

import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { TokenAnalysisInputCard } from '@/components/token-analysis/TokenAnalysisInputCard';
import { TokenAnalysisReportCard } from '@/components/token-analysis/TokenAnalysisReportCard';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { useTokenAnalysis } from '@/hooks/useTokenAnalysis';

export default function TokenAnalysisScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
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
      <TokenAnalysisInputCard
        mintInput={mintInput}
        onChangeMint={setMintInput}
        validationError={validationError}
        deterministicStatus={deterministicStatus}
        onAnalyze={() => {
          void analyzeToken();
        }}
        onClear={clearInput}
      />
      {report ? (
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
      ) : null}
      {!report && deterministicError ? <Text style={{ color: Colors.negative, fontSize: Typography.small, lineHeight: TypographyLineHeight.small }}>{deterministicError}</Text> : null}
    </Screen>
  );
}
