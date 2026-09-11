import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';

interface PageHeadingProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export function PageHeading({ eyebrow, title, subtitle }: PageHeadingProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  eyebrow: { color: Colors.accent, fontSize: Typography.label, lineHeight: TypographyLineHeight.label, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: Colors.text, fontSize: Typography.title, lineHeight: TypographyLineHeight.title, fontWeight: '900' },
  subtitle: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: TypographyLineHeight.body },
});