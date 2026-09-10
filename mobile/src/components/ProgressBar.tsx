import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

export function ProgressBar({ label, percentage }: { label: string; percentage: number }) {
  return <View style={styles.row}><View style={styles.heading}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{percentage}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${percentage}%` }]} /></View></View>;
}

const styles = StyleSheet.create({ row: { gap: Spacing.sm }, heading: { flexDirection: 'row', justifyContent: 'space-between' }, label: { color: Colors.secondaryText, fontSize: Typography.body }, value: { color: Colors.text, fontSize: Typography.small, fontWeight: '700' }, track: { backgroundColor: Colors.secondaryCard, borderRadius: Radius.pill, height: 7, overflow: 'hidden' }, fill: { backgroundColor: Colors.accent, borderRadius: Radius.pill, height: '100%' } });