import { StyleSheet, Text, View } from 'react-native';

import { AnalysisStatusBadge } from '@/components/token-analysis/AnalysisStatusBadge';
import type { FullAnalysisProvenanceSourceItem } from '@/domain/token-analysis/tokenAnalysisFullAnalysisPresentation';
import { Colors, Fonts, Radius, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';

interface ProvenanceSourceRowProps {
  source: FullAnalysisProvenanceSourceItem;
}

export function ProvenanceSourceRow({ source }: ProvenanceSourceRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.headerRow}>
        <AnalysisStatusBadge label={source.result} tone={source.tone} />
        <AnalysisStatusBadge label={source.sourceTrust.replaceAll('_', ' ')} tone="informational" />
      </View>
      <Text style={styles.publisher}>{source.publisher}</Text>
      <Text style={styles.body}>{source.detail}</Text>
      <Text style={styles.muted}>{source.evidenceSummary}</Text>
      <Text selectable style={styles.url}>{source.url}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, gap: Spacing.xs, padding: Spacing.md },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  publisher: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' },
  body: { color: Colors.text, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  muted: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  url: { color: Colors.mutedText, fontFamily: Fonts.mono, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
});
