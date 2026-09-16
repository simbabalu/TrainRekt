import { StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import type { TokenAnalysisSignal } from '@/domain/token-analysis/tokenAnalysisSummary';

const iconNames: Record<TokenAnalysisSignal['icon'], AppIconName> = {
  authority: { ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' },
  concentration: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  identity: { ios: 'person.crop.circle.fill', android: 'person', web: 'person' },
  review: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  tokenProgram: { ios: 'info.circle.fill', android: 'info', web: 'info' },
};

const informationalIcon: AppIconName = { ios: 'info.circle.fill', android: 'info', web: 'info' };
const reviewIcon: AppIconName = { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' };

const toneColors: Record<TokenAnalysisSignal['tone'], string> = {
  informational: Colors.accent,
  neutral: Colors.secondaryText,
  positive: Colors.positive,
  review: Colors.warning,
};

interface TokenAnalysisSignalRowProps {
  signal: TokenAnalysisSignal;
}

export function TokenAnalysisSignalRow({ signal }: TokenAnalysisSignalRowProps) {
  const toneColor = toneColors[signal.tone];
  const iconName = signal.tone === 'informational' ? informationalIcon : signal.tone === 'review' ? reviewIcon : iconNames[signal.icon];

  return (
    <View accessible style={styles.row}>
      <View style={[styles.icon, { backgroundColor: `${toneColor}22` }]}>
        <AppIcon accessibilityLabel={`${signal.label} signal`} name={iconName} size={20} tintColor={toneColor} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: toneColor }]}>{signal.label}</Text>
        <Text style={styles.value}>{signal.value}</Text>
        {signal.description ? <Text style={styles.description}>{signal.description}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.md, minHeight: 52, minWidth: 0, paddingVertical: Spacing.md },
  icon: { alignItems: 'center', borderRadius: 18, flexShrink: 0, height: 36, justifyContent: 'center', width: 36 },
  content: { flex: 1, gap: Spacing.xs, minWidth: 0 },
  label: { flexShrink: 1, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.7 },
  value: { color: Colors.text, flexShrink: 1, fontSize: Typography.body, fontWeight: '800', lineHeight: TypographyLineHeight.body },
  description: { color: Colors.secondaryText, flexShrink: 1, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
});
