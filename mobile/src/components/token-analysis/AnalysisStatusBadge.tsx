import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

type BadgeTone = 'positive' | 'review' | 'informational' | 'neutral';

const palette: Record<BadgeTone, { text: string; bg: string }> = {
  informational: { text: Colors.accent, bg: `${Colors.accent}22` },
  neutral: { text: Colors.secondaryText, bg: `${Colors.secondaryText}22` },
  positive: { text: Colors.positive, bg: `${Colors.positive}22` },
  review: { text: Colors.warning, bg: `${Colors.warning}22` },
};

interface AnalysisStatusBadgeProps {
  label: string;
  tone: BadgeTone;
}

export function AnalysisStatusBadge({ label, tone }: AnalysisStatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: palette[tone].bg, borderColor: palette[tone].text }]}>
      <Text style={[styles.text, { color: palette[tone].text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  text: { fontSize: Typography.small, fontWeight: '800', letterSpacing: 0.4 },
});
