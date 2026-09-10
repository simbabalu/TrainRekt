import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Training, Typography } from '@/constants/theme';
import { DailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

interface DailyTrainingCompleteCardProps {
  goalProgress: DailyGoalProgress;
  dailyTrainingStreak: number;
}

export function DailyTrainingCompleteCard({ goalProgress, dailyTrainingStreak }: DailyTrainingCompleteCardProps) {
  return (
    <SectionCard>
      <Text style={styles.title}>Daily training complete</Text>
      <View style={styles.summaryRow}>
        <View><Text style={styles.subtitle}>{goalProgress.completed} / {goalProgress.goal}</Text><Text style={styles.caption}>decisions</Text></View>
        <View><Text style={styles.bonus}>+{Training.dailyCompletionBonusXp} XP</Text><Text style={styles.caption}>bonus earned</Text></View>
      </View>
      {dailyTrainingStreak > 0 && <Text style={styles.streak}>{dailyTrainingStreak} day training streak</Text>}
      <View style={styles.actions}>
        <Link href="/" asChild><PrimaryButton onPress={() => undefined}>BACK TO HOME</PrimaryButton></Link>
        <Link href={{ pathname: '/train', params: { mode: 'practice' } } as Href} asChild>
          <PrimaryButton variant="secondary" onPress={() => undefined}>EXTRA PRACTICE</PrimaryButton>
        </Link>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.positive, fontSize: Typography.heading, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.lg },
  subtitle: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  bonus: { color: Colors.positive, fontSize: Typography.heading, fontWeight: '800' },
  caption: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  streak: { color: Colors.accent, fontSize: Typography.small, fontWeight: '800', marginTop: Spacing.md },
  actions: { gap: Spacing.sm, marginTop: Spacing.lg },
});
