import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';

interface AnalysisFactRowProps {
  label: string;
  value: string;
  description?: string;
  valueTone?: 'text' | 'positive' | 'warning' | 'accent';
  monospace?: boolean;
  selectable?: boolean;
}

const valueColors: Record<NonNullable<AnalysisFactRowProps['valueTone']>, string> = {
  accent: Colors.accent,
  positive: Colors.positive,
  text: Colors.text,
  warning: Colors.warning,
};

export function AnalysisFactRow({
  label,
  value,
  description,
  valueTone = 'text',
  monospace = false,
  selectable = false,
}: AnalysisFactRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable={selectable} style={[styles.value, { color: valueColors[valueTone] }, monospace ? styles.monospace : null]}>{value}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  label: { color: Colors.mutedText, fontSize: Typography.small, fontWeight: '800', letterSpacing: 0.5 },
  value: { fontSize: Typography.body, fontWeight: '800', lineHeight: TypographyLineHeight.body },
  description: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  monospace: { fontFamily: Fonts.mono },
});
