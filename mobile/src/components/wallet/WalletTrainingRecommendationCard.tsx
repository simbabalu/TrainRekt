import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getWalletTrainingTopicLabel } from '@/domain/wallet/recommendWalletTraining';
import type { WalletTrainingRecommendation } from '@/types/walletTraining';
import type { WalletSafetySignalKind } from '@/types/walletInspection';

interface WalletTrainingRecommendationCardProps {
  recommendation: WalletTrainingRecommendation;
  onStartLesson: (recommendation: WalletTrainingRecommendation) => void;
}

const lessonIconBySignal: Record<WalletSafetySignalKind, { ios: string; android: string; web: string }> = {
  'frozen-account': { ios: 'snowflake', android: 'ac_unit', web: 'ac_unit' },
  'delegated-account': { ios: 'person.badge.key.fill', android: 'key', web: 'key' },
  'token-2022-account': { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  'empty-token-account': { ios: 'tray', android: 'inventory_2', web: 'inventory_2' },
};

export function WalletTrainingRecommendationCard({ recommendation, onStartLesson }: WalletTrainingRecommendationCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppIcon
          accessibilityLabel={getWalletTrainingTopicLabel(recommendation.topic)}
          name={lessonIconBySignal[recommendation.sourceSignalType]}
          size={16}
        />
        <Text style={styles.title}>{getWalletTrainingTopicLabel(recommendation.topic)}</Text>
      </View>
      <Text style={styles.count}>{recommendation.observedAccountCount} account{recommendation.observedAccountCount === 1 ? '' : 's'} observed</Text>
      <Text style={styles.reason}>{compactReason[recommendation.topic]}</Text>
      <PrimaryButton variant="secondary" onPress={() => onStartLesson(recommendation)}>
        START LESSON
      </PrimaryButton>
    </View>
  );
}

const compactReason = {
  'token-account-state': 'Learn why frozen accounts need context.',
  'delegated-authority': 'Learn how delegated authority should be reviewed.',
  'token-2022': 'Learn what Token-2022 means and why it is not itself a warning.',
  'empty-token-account': 'Learn why zero-balance accounts can remain on-chain.',
} as const;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  title: {
    color: Colors.text,
    flexShrink: 1,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  count: {
    color: Colors.accent,
    fontSize: Typography.small,
    fontWeight: '700',
  },
  reason: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
});
