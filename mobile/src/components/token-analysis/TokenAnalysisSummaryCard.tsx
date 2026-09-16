import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { TokenAnalysisSignalRow } from '@/components/token-analysis/TokenAnalysisSignalRow';
import { buildTokenAnalysisSummary } from '@/domain/token-analysis/tokenAnalysisSummary';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import type { TokenAnalysisReport, TokenInspectionResearchStatus } from '@/types/tokenAnalysis';

interface TokenAnalysisSummaryCardProps {
  report: TokenAnalysisReport;
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
}: TokenAnalysisSummaryCardProps) {
  const [failedLogoUri, setFailedLogoUri] = useState<string | null>(null);
  const logoUri = report.inspection.identity.logoUri?.trim() || null;
  const tokenName = report.inspection.identity.name?.trim() || 'Unknown';
  const tokenSymbol = report.inspection.identity.symbol?.trim() || 'Unknown';
  const showLogoImage = Boolean(logoUri) && failedLogoUri !== logoUri;

  return (
    <View>
      <Text style={styles.eyebrow}>TOKEN IDENTITY</Text>
      <View style={styles.identityRow}>
        {showLogoImage ? (
          <Image
            accessibilityLabel="Token logo"
            onError={() => setFailedLogoUri(logoUri)}
            source={{ uri: logoUri! }}
            style={styles.logo}
          />
        ) : (
          <View style={styles.fallbackIcon}>
            <AppIcon accessibilityLabel="Generic token icon" name={{ ios: 'circle.hexagongrid.fill', android: 'radio_button_checked', web: 'radio_button_checked' }} badge />
          </View>
        )}
        <View style={styles.identityTextBlock}>
          <Text selectable style={styles.tokenName}>{tokenName}</Text>
          <Text style={styles.symbol}>{tokenSymbol}</Text>
        </View>
      </View>
      <Text style={styles.identityLabel}>Mint</Text>
      <Text selectable style={styles.mint}>{report.inspection.identity.mint}</Text>
    </View>
  );
}

export function TokenAnalysisOnChainSummary({ report }: TokenAnalysisSummaryCardProps) {
  const summary = buildTokenAnalysisSummary(report);
  const optionalResearch = presentOptionalResearch(report.inspection.researchStatus);

  return (
    <View>
      <Text style={styles.sectionTitle}>ON-CHAIN SUMMARY</Text>
      <View style={styles.findings}>
        {summary.findings.map((finding) => <TokenAnalysisSignalRow key={finding.id} signal={finding} />)}
      </View>
      <Text style={styles.neutralInfo}>Deterministic inspection: complete.</Text>
      {optionalResearch ? <Text style={styles.neutralInfo}>{optionalResearch}</Text> : null}
      <Text style={styles.disclaimer}>Signals are technical observations — not a safety verdict.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  sectionTitle: { color: Colors.text, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  fallbackIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    width: 36,
  },
  identityTextBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  identityLabel: {
    color: Colors.mutedText,
    fontSize: Typography.small,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },
  tokenName: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900', lineHeight: TypographyLineHeight.heading },
  symbol: { color: Colors.secondaryText, fontSize: Typography.body, fontWeight: '700' },
  mint: { color: Colors.mutedText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  neutralInfo: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
    marginTop: Spacing.sm,
  },
  disclaimer: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small, marginTop: Spacing.xs },
  findings: { marginTop: Spacing.sm },
});
