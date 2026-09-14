import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, LayoutSpacing, Radius } from '@/constants/theme';

export function SectionCard({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: LayoutSpacing.cardSectionGap,
    padding: LayoutSpacing.cardPadding,
  },
});