import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { formatPercentage } from '@/domain/progress/formatPercentage';

export function ProgressBar({ label, percentage }: { label: string; percentage: number }) {
  const normalizedPercentage = Math.min(100, Math.max(0, percentage));
  return <View style={styles.row}><View style={styles.heading}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{formatPercentage(normalizedPercentage)}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${normalizedPercentage}%` }]} /></View></View>;
}

const styles = StyleSheet.create({ row: { gap: Spacing.sm }, heading: { flexDirection: 'row', justifyContent: 'space-between' }, label: { color: Colors.secondaryText, fontSize: Typography.body }, value: { color: Colors.text, fontSize: Typography.small, fontWeight: '700' }, track: { backgroundColor: Colors.secondaryCard, borderRadius: Radius.pill, height: 7, overflow: 'hidden' }, fill: { backgroundColor: Colors.accent, borderRadius: Radius.pill, height: '100%' } });