import { Image, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { WalletHeaderControl } from '@/components/WalletHeaderControl';
import { appHeaderLogo } from '@/components/appHeaderLogo';

export function AppHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image
          accessibilityLabel="TrainRekt logo"
          source={appHeaderLogo}
          style={styles.logo}
        />
        <Text style={styles.title}>TRAINREKT</Text>
      </View>
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
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  logo: {
    height: 42,
    width: 42,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});
