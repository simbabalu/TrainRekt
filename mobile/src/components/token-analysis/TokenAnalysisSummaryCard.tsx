import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { TokenAnalysisSignalRow } from '@/components/token-analysis/TokenAnalysisSignalRow';
import { buildTokenAnalysisSummary } from '@/domain/token-analysis/tokenAnalysisSummary';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import type { TokenAnalysisReport, TokenInspectionResearchStatus } from '@/types/tokenAnalysis';

interface TokenAnalysisSummaryCardProps {
  report: TokenAnalysisReport;
  onUnderstandSignals: () => void;
  onToggleFullAnalysis: () => void;
  isFullAnalysisVisible: boolean;
}

function presentOptionalResearch(status: TokenInspectionResearchStatus | null | undefined): string | null {
  if (!status) return null;

  switch (status.availability) {
    case 'complete':
      return 'Optional external research: complete.';
    case 'partial':
      return 'Optional external research: partially available.';
    case 'unavailable':
      return 'Additional external research is unavailable. Deterministic inspection remains available.';
    case 'not-attempted':
      return 'Optional external research: not attempted.';
    default:
      return null;
  }
}

export function TokenAnalysisSummaryCard({
  report,
  onUnderstandSignals,
  onToggleFullAnalysis,
  isFullAnalysisVisible,
}: TokenAnalysisSummaryCardProps) {
  const summary = buildTokenAnalysisSummary(report);
  const optionalResearch = presentOptionalResearch(report.inspection.researchStatus);

  return (
    <SectionCard>
      <Text style={styles.eyebrow}>TOKEN ANALYSIS SUMMARY</Text>
      <Text selectable style={styles.tokenName}>{report.inspection.identity.name}</Text>
      <Text style={styles.symbol}>{report.inspection.identity.symbol}</Text>
      <Text selectable style={styles.mint}>Mint: {report.inspection.identity.mint}</Text>
      <Text style={[styles.status, summary.status === 'NEEDS REVIEW' ? styles.reviewStatus : styles.clearStatus]}>{summary.status}</Text>
      <Text style={styles.findingsTitle}>Key findings</Text>
      <View style={styles.findings}>
        {summary.findings.map((finding) => <TokenAnalysisSignalRow key={finding.id} signal={finding} />)}
      </View>
      <Text style={styles.neutralInfo}>Deterministic inspection: complete.</Text>
      {optionalResearch ? <Text style={styles.neutralInfo}>{optionalResearch}</Text> : null}
      <Text style={styles.disclaimer}>Signals are technical observations — not a safety verdict.</Text>
      <View style={styles.actions}>
        <PrimaryButton onPress={onUnderstandSignals}>UNDERSTAND THE SIGNALS</PrimaryButton>
        <PrimaryButton
          onPress={onToggleFullAnalysis}
          variant="secondary"
        >
          {isFullAnalysisVisible ? 'HIDE FULL ANALYSIS' : 'VIEW FULL ANALYSIS'}
        </PrimaryButton>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  tokenName: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900', lineHeight: TypographyLineHeight.heading, marginTop: Spacing.sm },
  symbol: { color: Colors.secondaryText, fontSize: Typography.body, fontWeight: '700' },
  mint: { color: Colors.mutedText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small, marginTop: Spacing.sm },
  status: { fontSize: Typography.body, fontWeight: '900', letterSpacing: 0.6, marginTop: Spacing.md },
  reviewStatus: { color: Colors.warning },
  clearStatus: { color: Colors.secondaryText },
  neutralInfo: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
    marginTop: Spacing.sm,
  },
  disclaimer: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small, marginTop: Spacing.xs },
  findingsTitle: { color: Colors.text, fontSize: Typography.body, fontWeight: '800', marginTop: Spacing.lg },
  findings: { marginTop: Spacing.sm },
  actions: { gap: Spacing.sm, marginTop: Spacing.lg },
});
