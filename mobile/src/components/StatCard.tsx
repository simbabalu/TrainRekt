import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { AppIcon, type AppIconName } from './AppIcon';

interface StatCardProps { label: string; value: string; detail?: string; iconName?: AppIconName; }

export function StatCard({ label, value, detail, iconName }: StatCardProps) {
  return <View style={styles.card}>{iconName && <AppIcon accessibilityLabel={label} name={iconName} size={16} />}<Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text>{detail && <Text style={styles.detail}>{detail}</Text>}</View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, flex: 1, minHeight: 104, padding: Spacing.md }, label: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small, marginBottom: Spacing.sm }, value: { color: Colors.text, fontSize: Typography.heading, lineHeight: TypographyLineHeight.heading, fontWeight: '800' }, detail: { color: Colors.accent, fontSize: Typography.small, lineHeight: TypographyLineHeight.small, fontWeight: '700', marginTop: Spacing.xs } });