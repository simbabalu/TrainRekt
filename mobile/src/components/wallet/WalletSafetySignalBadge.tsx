import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { WalletSafetySignal } from '@/types/walletInspection';

const labelByKind: Record<WalletSafetySignal['kind'], string> = {
  'delegated-account': 'DELEGATED',
  'frozen-account': 'FROZEN',
  'token-2022-account': 'TOKEN-2022',
  'empty-token-account': 'EMPTY',
};

interface WalletSafetySignalBadgeProps {
  signal: WalletSafetySignal;
}

export function WalletSafetySignalBadge({ signal }: WalletSafetySignalBadgeProps) {
  const reviewSignal = signal.category === 'review';
  return (
    <View style={[styles.badge, reviewSignal ? styles.badgeReview : styles.badgeInformational]}>
      <Text style={[styles.text, reviewSignal ? styles.textReview : styles.textInformational]}>{labelByKind[signal.kind]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.secondaryCard,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.half,
  },
  badgeReview: {
    borderColor: Colors.warning,
  },
  badgeInformational: {
    borderColor: Colors.border,
  },
  text: {
    fontSize: Typography.label,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textReview: {
    color: Colors.warning,
  },
  textInformational: {
    color: Colors.secondaryText,
  },
});
