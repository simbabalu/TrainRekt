import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import type { WalletInspectionCategorySummary, WalletInspectionSummary as WalletInspectionSummaryModel } from '@/types/walletInspection';

interface WalletInspectionSummaryProps {
  summary: WalletInspectionSummaryModel;
  categorySummary: WalletInspectionCategorySummary;
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function WalletInspectionSummary({ summary, categorySummary }: WalletInspectionSummaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.reviewed}>{categorySummary.inspectedAccountCount} accounts inspected</Text>
      <View style={styles.primaryRow}>
        <SummaryMetric label="NEED REVIEW" value={categorySummary.reviewAccountCount} />
        <SummaryMetric label="INFORMATIONAL" value={categorySummary.informationalAccountCount} />
        <SummaryMetric label="NO REVIEW SIGNALS" value={categorySummary.noReviewSignalAccountCount} />
      </View>
      <Text style={styles.note}>Review categories are exclusive. Technical signals may overlap.</Text>
      <Text style={styles.secondaryTitle}>Technical breakdown</Text>
      <View style={styles.row}>
        <SummaryMetric label="FROZEN" value={summary.frozenTokenAccounts} />
        <SummaryMetric label="DELEGATED" value={summary.delegatedTokenAccounts} />
        <SummaryMetric label="TOKEN-2022" value={summary.token2022TokenAccounts} />
        <SummaryMetric label="EMPTY" value={summary.emptyTokenAccounts} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  reviewed: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
  },
  primaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  secondaryTitle: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  note: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metric: {
    minWidth: 72,
  },
  metricValue: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '900',
  },
  metricLabel: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
});
