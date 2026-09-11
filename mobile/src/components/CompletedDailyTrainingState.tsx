import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Training, Typography } from '@/constants/theme';
import { DailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { PrimaryButton } from './PrimaryButton';
import { ProgressBar } from './ProgressBar';
import { SectionCard } from './SectionCard';

interface CompletedDailyTrainingStateProps {
  goalProgress: DailyGoalProgress;
  dailyTrainingStreak: number;
}

export function CompletedDailyTrainingState({ goalProgress, dailyTrainingStreak }: CompletedDailyTrainingStateProps) {
  return (
    <>
      <ProgressBar label={`${goalProgress.completed} / ${goalProgress.goal} COMPLETE`} percentage={100} />
      <SectionCard>
        <Text style={styles.title}>TODAY&apos;S TRAINING COMPLETE</Text>
        <View style={styles.summaryRow}>
          <View><Text style={styles.value}>{goalProgress.completed} / {goalProgress.goal}</Text><Text style={styles.caption}>decisions</Text></View>
          <View><Text style={styles.bonus}>+{Training.dailyCompletionBonusXp} XP</Text><Text style={styles.caption}>Daily bonus earned</Text></View>
        </View>
        {dailyTrainingStreak > 0 && <Text style={styles.streak}>{dailyTrainingStreak} day training streak</Text>}
        <View style={styles.actions}>
          <Link href={{ pathname: '/train', params: { mode: 'practice' } } as Href} asChild>
            <PrimaryButton onPress={() => undefined}>EXTRA PRACTICE</PrimaryButton>
          </Link>
          <Link href="/" asChild><PrimaryButton onPress={() => undefined} variant="secondary">BACK TO HOME</PrimaryButton></Link>
        </View>
      </SectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.positive, fontSize: Typography.heading, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: Spacing.xxl, marginTop: Spacing.lg },
  value: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  bonus: { color: Colors.positive, fontSize: Typography.heading, fontWeight: '800' },
  caption: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  streak: { color: Colors.accent, fontSize: Typography.small, fontWeight: '800', marginTop: Spacing.md },
  actions: { gap: Spacing.sm, marginTop: Spacing.lg },
});