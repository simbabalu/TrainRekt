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
      <Text style={styles.subtitle}>{goalProgress.completed} / {goalProgress.goal} decisions</Text>
      <Text style={styles.bonus}>+{Training.dailyCompletionBonusXp} XP bonus earned</Text>
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
  subtitle: { color: Colors.text, fontSize: Typography.body, fontWeight: '700', marginTop: Spacing.sm },
  bonus: { color: Colors.positive, fontSize: Typography.small, fontWeight: '700', marginTop: Spacing.xs },
  streak: { color: Colors.accent, fontSize: Typography.small, fontWeight: '800', marginTop: Spacing.md },
  actions: { gap: Spacing.sm, marginTop: Spacing.lg },
});
