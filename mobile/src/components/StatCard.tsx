import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface StatCardProps { label: string; value: string; detail?: string; }

export function StatCard({ label, value, detail }: StatCardProps) {
  return <View style={styles.card}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text>{detail && <Text style={styles.detail}>{detail}</Text>}</View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, flex: 1, minHeight: 104, padding: Spacing.md }, label: { color: Colors.secondaryText, fontSize: Typography.small, marginBottom: Spacing.sm }, value: { color: Colors.text, fontSize: 24, fontWeight: '800' }, detail: { color: Colors.accent, fontSize: Typography.small, fontWeight: '700', marginTop: Spacing.xs } });