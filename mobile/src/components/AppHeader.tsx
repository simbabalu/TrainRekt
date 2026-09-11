import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { WalletHeaderControl } from '@/components/WalletHeaderControl';

export function AppHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>TRAINREKT</Text>
      <WalletHeaderControl />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});
