import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { AnalysisSectionHeader } from '@/components/token-analysis/AnalysisSectionHeader';
import { TokenAnalysisOnChainSummary, TokenAnalysisSummaryCard } from '@/components/token-analysis/TokenAnalysisSummaryCard';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { recommendTokenAnalysisTraining } from '@/domain/token-analysis/recommendTokenAnalysisTraining';
import {
  mapCoachTopicToTrainingCta,
} from '@/domain/token-analysis/tokenAnalysisPresentation';
import type { TokenAnalysisAiStatus, TokenAnalysisReport, TokenInspectionCoachResponse } from '@/types/tokenAnalysis';
import type { WalletTrainingTopic } from '@/types/walletTraining';

interface TokenAnalysisReportCardProps {
  report: TokenAnalysisReport;
  deterministicError: string | null;
  aiStatus: TokenAnalysisAiStatus;
  aiError: string | null;
  coach: TokenInspectionCoachResponse['coach'];
  onRetryAi: () => void;
  onStartTraining: (topic: WalletTrainingTopic, exerciseId: string) => void;
}

function pct(value: number | null): string {
  if (value == null) return 'Unavailable';
  return `${value.toFixed(2)}%`;
}

function presentAccountContext(protocol: string | null, classification: string): string {
  if (protocol?.toLowerCase() === 'pumpswap' && classification.toLowerCase() === 'liquidity_pool') {
    return 'PumpSwap LP';
  }

  if (protocol) {
    return `${protocol} protocol`;
  }

  return classification.toLowerCase() === 'unknown' ? 'Unclassified account context' : classification;
}

function CoachBulletList({ items, keyPrefix }: { items: string[]; keyPrefix: string }) {
  return items.map((item, index) => (
    <View key={`${keyPrefix}:${item}:${index}`} style={styles.bulletRow}>
      <Text style={styles.bullet}>-</Text>
      <Text style={styles.body}>{item}</Text>
    </View>
  ));
}

export function TokenAnalysisReportCard({
  report,
  deterministicError,
  aiStatus,
  aiError,
  coach,
  onRetryAi,
  onStartTraining,
}: TokenAnalysisReportCardProps) {
  const topAccounts = report.inspection.largestTokenAccounts.slice(0, 5);
  const coachTraining = mapCoachTopicToTrainingCta(coach?.recommendedTrainingTopicId ?? null);
  const summaryTraining = recommendTokenAnalysisTraining(report);

  return (
    <View style={styles.container}>
      <SectionCard>
        <TokenAnalysisSummaryCard report={report} />
        {deterministicError ? (
          <Text style={styles.error}>{deterministicError}</Text>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.takeawayTitle}>KEY TAKEAWAYS</Text>
          {aiStatus === 'idle' || aiStatus === 'loading' ? (
            <View style={styles.takeawaySurface}>
              <Text style={styles.muted}>Loading key takeaways...</Text>
            </View>
          ) : null}
          {aiStatus === 'unavailable' ? (
            <View style={styles.takeawaySurface}>
              <Text style={styles.error}>{aiError ?? 'AI explanation is currently unavailable.'}</Text>
              <PrimaryButton onPress={onRetryAi} variant="secondary">TRY AGAIN</PrimaryButton>
            </View>
          ) : null}
          {aiStatus === 'ready' && coach ? (
            <View style={styles.takeawaySurface}>
              <Text style={styles.takeawayText}>{coach.summary}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        <TokenAnalysisOnChainSummary report={report} />

        <View style={styles.divider} />

        <View style={styles.section}>
          <AnalysisSectionHeader icon="concentration" title="TOKEN DISTRIBUTION (TOP 5 ACCOUNTS)" />
          {topAccounts.length === 0 ? <Text style={styles.muted}>No largest-account data was returned.</Text> : topAccounts.map((account, index) => {
            const percent = account.percentage ?? 0;
            const isProtocolAccount = Boolean(account.classification.protocol);
            const barWidth = `${Math.max(2, Math.min(100, percent))}%` as `${number}%`;
            return (
              <View key={`distribution:${account.address}:${index}`} style={styles.distributionRow}>
                <View style={styles.distributionHeader}>
                  <Text style={styles.distributionRank}>#{index + 1}</Text>
                  <Text style={styles.distributionLabel} numberOfLines={1}>{presentAccountContext(account.classification.protocol, account.classification.classification)}</Text>
                  <Text style={styles.distributionValue}>{pct(account.percentage)}</Text>
                </View>
                <View style={styles.distributionTrack}>
                  <View
                    style={[
                      styles.distributionFill,
                      { width: barWidth },
                      isProtocolAccount ? styles.protocolFill : styles.unknownFill,
                    ]}
                  />
                </View>
              </View>
            );
          })}
          <Text style={styles.muted}>{report.inspection.holderConcentration.semanticsNote}</Text>
        </View>

        {aiStatus === 'ready' && coach ? (
          <>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>KEY POINTS</Text>
              <CoachBulletList items={coach.riskExplanations} keyPrefix="coach-risk" />
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>WHAT TO CHECK NEXT</Text>
              <CoachBulletList items={coach.whatToCheckNext} keyPrefix="coach-next" />
            </View>
            {coachTraining ? (
              <PrimaryButton onPress={() => onStartTraining(coachTraining.topic, coachTraining.exerciseId)}>
                PRACTICE THIS SKILL
              </PrimaryButton>
            ) : null}
          </>
        ) : null}
      </SectionCard>
      {summaryTraining ? (
        <SectionCard>
          <PrimaryButton onPress={() => onStartTraining(summaryTraining.topic, summaryTraining.exerciseId)}>UNDERSTAND THE SIGNALS</PrimaryButton>
        </SectionCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  divider: {
    backgroundColor: Colors.border,
    height: 1,
  },
  takeawayTitle: {
    color: Colors.accent,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  takeawaySurface: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.accent,
    borderLeftWidth: 3,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  takeawayText: {
    color: Colors.text,
    fontSize: Typography.body,
    lineHeight: TypographyLineHeight.body,
  },
  distributionRow: {
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  distributionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  distributionRank: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    fontWeight: '800',
    minWidth: 22,
  },
  distributionLabel: {
    color: Colors.text,
    flex: 1,
    fontSize: Typography.small,
    fontWeight: '700',
  },
  distributionValue: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '900',
  },
  distributionTrack: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 6,
    overflow: 'hidden',
  },
  distributionFill: {
    borderRadius: 999,
    height: '100%',
  },
  protocolFill: {
    backgroundColor: Colors.accent,
  },
  unknownFill: {
    backgroundColor: Colors.mutedText,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bullet: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
    marginTop: 1,
  },
  body: {
    color: Colors.text,
    flex: 1,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  muted: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  error: {
    color: Colors.negative,
    fontSize: Typography.small,
    fontWeight: '700',
  },
});
