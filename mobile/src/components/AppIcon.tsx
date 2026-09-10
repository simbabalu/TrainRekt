import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type AppIconName = {
  ios: string;
  android: string;
  web: string;
};

interface AppIconProps {
  name: AppIconName;
  accessibilityLabel: string;
  size?: number;
  tintColor?: string;
  badge?: boolean;
}

export function AppIcon({ name, accessibilityLabel, size = 18, tintColor = Colors.accent, badge = false }: AppIconProps) {
  const icon = <SymbolView name={name as SymbolViewProps['name']} size={size} tintColor={tintColor} weight="semibold" />;

  if (!badge) {
    return <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.inline}>{icon}</View>;
  }

  return <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.badge}>{icon}</View>;
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', backgroundColor: Colors.secondaryCard, borderColor: Colors.border, borderRadius: Radius.pill, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  inline: { alignItems: 'center', justifyContent: 'center', marginRight: Spacing.xs },
});
