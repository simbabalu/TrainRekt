import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { DailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';

export function DailyGoalInlineStatus({ goalProgress }: { goalProgress: DailyGoalProgress }) {
  return (
    <View style={styles.container}>
      <Text style={styles.status}>Daily goal: {goalProgress.completed} / {goalProgress.goal}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: Spacing.md },
  status: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
});
