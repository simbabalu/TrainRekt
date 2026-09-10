import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Training, Typography } from '@/constants/theme';
import { DailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { ProgressBar } from './ProgressBar';
import { SectionCard } from './SectionCard';

interface DailyGoalCardProps {
  goalProgress: DailyGoalProgress;
  dailyTrainingStreak: number;
}

export function DailyGoalCard({ goalProgress, dailyTrainingStreak }: DailyGoalCardProps) {
  return (
    <SectionCard>
      <Text style={styles.title}>Daily goal</Text>
      <ProgressBar label={`${goalProgress.completed} / ${goalProgress.goal} decisions`} percentage={goalProgress.percentage} />
      {goalProgress.isComplete && (
        <View style={styles.completeBlock}>
          <Text style={styles.complete}>Daily training complete</Text>
          <Text style={styles.bonus}>+{Training.dailyCompletionBonusXp} XP bonus earned</Text>
        </View>
      )}
      {dailyTrainingStreak > 0 && <Text style={styles.streak}>{dailyTrainingStreak} day training streak</Text>}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2, marginBottom: Spacing.md },
  completeBlock: { marginTop: Spacing.md },
  complete: { color: Colors.positive, fontSize: Typography.body, fontWeight: '800' },
  bonus: { color: Colors.positive, fontSize: Typography.small, fontWeight: '700', marginTop: Spacing.xs },
  streak: { color: Colors.accent, fontSize: Typography.small, fontWeight: '800', marginTop: Spacing.md },
});
