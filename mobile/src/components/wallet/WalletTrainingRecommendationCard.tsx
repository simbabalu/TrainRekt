import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getWalletTrainingTopicLabel } from '@/domain/wallet/recommendWalletTraining';
import type { WalletLessonStatus } from '@/domain/wallet/getWalletLessonStatus';
import type { WalletTrainingRecommendation } from '@/types/walletTraining';
import type { WalletSafetySignalKind } from '@/types/walletInspection';

interface WalletTrainingRecommendationCardProps {
  recommendation: WalletTrainingRecommendation;
  status: WalletLessonStatus;
  onStartLesson: (recommendation: WalletTrainingRecommendation) => void;
}

const lessonIconBySignal: Record<WalletSafetySignalKind, { ios: string; android: string; web: string }> = {
  'frozen-account': { ios: 'snowflake', android: 'ac_unit', web: 'ac_unit' },
  'delegated-account': { ios: 'person.badge.key.fill', android: 'key', web: 'key' },
  'token-2022-account': { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  'empty-token-account': { ios: 'tray', android: 'inventory_2', web: 'inventory_2' },
  'mint-authority-active': { ios: 'plus.circle', android: 'add_circle', web: 'add_circle' },
  'freeze-authority-active': { ios: 'snowflake', android: 'ac_unit', web: 'ac_unit' },
  'token-2022-permanent-delegate': { ios: 'person.badge.key.fill', android: 'key', web: 'key' },
  'token-2022-transfer-fee-config': { ios: 'percent', android: 'percent', web: 'percent' },
  'token-2022-transfer-hook': { ios: 'link.badge.plus', android: 'link', web: 'link' },
  'token-2022-non-transferable': { ios: 'arrow.left.and.right.slash', android: 'swap_horiz', web: 'swap_horiz' },
  'token-2022-default-account-state': { ios: 'list.bullet.rectangle.portrait', android: 'view_list', web: 'view_list' },
  'token-2022-interest-bearing-config': { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' },
  'token-2022-metadata-pointer': { ios: 'doc.text.magnifyingglass', android: 'description', web: 'description' },
  'token-2022-group-pointer': { ios: 'person.3', android: 'groups', web: 'groups' },
  'token-2022-group-member-pointer': { ios: 'person.2', android: 'group', web: 'group' },
};

export function WalletTrainingRecommendationCard({ recommendation, status, onStartLesson }: WalletTrainingRecommendationCardProps) {
  const completed = status !== 'not-started';
  const statusLabel = status === 'passed' ? 'PASSED' : status === 'failed' ? 'FAILED' : null;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppIcon
          accessibilityLabel={getWalletTrainingTopicLabel(recommendation.topic)}
          name={lessonIconBySignal[recommendation.sourceSignalType]}
          size={16}
        />
        <Text style={styles.title}>{getWalletTrainingTopicLabel(recommendation.topic)}</Text>
        {statusLabel && <Text style={[styles.status, status === 'passed' ? styles.statusPassed : styles.statusFailed]}>{statusLabel}</Text>}
      </View>
      <Text style={styles.count}>{recommendation.observedAccountCount} account{recommendation.observedAccountCount === 1 ? '' : 's'} observed</Text>
      <Text style={styles.reason}>{compactReason[recommendation.topic]}</Text>
      {completed && <Text style={styles.completed}>Completed</Text>}
      <PrimaryButton variant="secondary" onPress={() => onStartLesson(recommendation)}>
        {completed ? 'RETRY LESSON' : 'START LESSON'}
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
  status: {
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginLeft: 'auto',
  },
  statusPassed: { color: Colors.positive },
  statusFailed: { color: Colors.negative },
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
  completed: {
    color: Colors.secondaryText,
    fontSize: Typography.label,
  },
});
