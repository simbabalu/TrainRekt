import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function SectionCard({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg } });