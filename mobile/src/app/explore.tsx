import { StyleSheet, Text, View } from 'react-native';

import { LevelProgressCard } from '@/components/LevelProgressCard';
import { PageHeading } from '@/components/PageHeading';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { calculateDailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { SkillKey } from '@/types/progress';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

const skillKeys: SkillKey[] = ['riskManagement', 'profitTaking', 'fomoResistance', 'positionSizing', 'scamAwareness', 'leverageRisk', 'panicSelling', 'marketInterpretation', 'walletSafety'];
const statIcons: Record<'Sessions' | 'Correct' | 'Wrong' | 'Accuracy' | 'Best streak', AppIconName> = {
  Sessions: { ios: 'figure.run', android: 'fitness_center', web: 'fitness_center' },
  Correct: { ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' },
  Wrong: { ios: 'xmark.circle', android: 'cancel', web: 'cancel' },
  Accuracy: { ios: 'scope', android: 'target', web: 'target' },
  'Best streak': { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
};

function SectionHeader({ title, iconName, iconLabel }: { title: string; iconName: AppIconName; iconLabel: string }) {
  return <View style={styles.sectionHeader}><AppIcon accessibilityLabel={iconLabel} name={iconName} badge /><Text style={styles.sectionTitle}>{title}</Text></View>;
}

export default function ProgressScreen() {
  const { progress } = useTrainingProgress();
  const stats = [['Sessions', progress.sessionsCompleted], ['Correct', progress.correctDecisions], ['Wrong', progress.wrongDecisions], ['Accuracy', `${progress.winRate}%`], ['Best streak', progress.bestStreak]] as const;
  const dailyGoalProgress = calculateDailyGoalProgress(progress.daily);

  return (
    <Screen>
      <PageHeading eyebrow="PROGRESS" title="Your training progress" />
      <LevelProgressCard summary={progress} totalXp={progress.totalXp} />
      <SectionCard><SectionHeader title="TRAINING STATS" iconName={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }} iconLabel="Training stats" /><View style={styles.stats}>{stats.map(([label, value]) => <View key={label} style={styles.stat}><AppIcon accessibilityLabel={label} name={statIcons[label]} size={16} tintColor={Colors.mutedText} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View><Text style={styles.currentStreak}>Current streak: {progress.currentStreak} correct</Text></SectionCard>
      <SectionCard>
        <SectionHeader title="DAILY TRAINING" iconName={{ ios: 'calendar.badge.checkmark', android: 'event_available', web: 'event_available' }} iconLabel="Daily training" />
        <View style={styles.stats}>
          <View style={styles.stat}><AppIcon accessibilityLabel="Today's goal" name={{ ios: 'target', android: 'track_changes', web: 'track_changes' }} size={16} tintColor={Colors.mutedText} /><Text style={styles.statValue}>{dailyGoalProgress.completed}/{dailyGoalProgress.goal}</Text><Text style={styles.statLabel}>Today&apos;s goal</Text></View>
          <View style={styles.stat}><AppIcon accessibilityLabel="Daily streak" name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} size={16} tintColor={Colors.mutedText} /><Text style={styles.statValue}>{progress.daily.dailyTrainingStreak}</Text><Text style={styles.statLabel}>Daily streak</Text></View>
          <View style={styles.stat}><AppIcon accessibilityLabel="Best daily streak" name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }} size={16} tintColor={Colors.mutedText} /><Text style={styles.statValue}>{progress.daily.bestDailyTrainingStreak}</Text><Text style={styles.statLabel}>Best daily streak</Text></View>
        </View>
      </SectionCard>
      <SectionCard><SectionHeader title="SKILLS" iconName={{ ios: 'scope', android: 'target', web: 'target' }} iconLabel="Skills" /><View style={styles.skills}>{skillKeys.map((skill) => <ProgressBar key={skill} label={skillLabels[skill]} percentage={progress.skillScores[skill]} />)}</View></SectionCard>
      <SectionCard><SectionHeader title="RECENT TRAINING" iconName={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }} iconLabel="Recent training" /><View style={styles.history}>{progress.recentTrainingHistory.slice(0, 3).map((entry) => <View key={entry.id} style={styles.historyRow}><AppIcon accessibilityLabel="Training history entry" name={{ ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' }} size={16} tintColor={Colors.mutedText} /><View style={styles.historyMain}><Text style={styles.historyTitle}>{entry.scenarioTitle}</Text><Text style={[styles.historyResult, entry.correct ? styles.positive : styles.negative]}>{entry.correct ? 'Correct' : 'Wrong'}  •  {skillLabels[entry.skill]}</Text></View><Text style={styles.historyXp}>+{entry.xpEarned} XP</Text></View>)}</View></SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md, rowGap: Spacing.md },
  stat: { width: '33%' },
  statValue: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  statLabel: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  currentStreak: { color: Colors.accent, fontSize: Typography.small, fontWeight: '800', marginTop: Spacing.lg },
  skills: { gap: Spacing.md, marginTop: Spacing.md },
  history: { gap: Spacing.md, marginTop: Spacing.md },
  historyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyMain: { flex: 1, paddingRight: Spacing.md },
  historyTitle: { color: Colors.text, fontSize: Typography.body, fontWeight: '700' },
  historyResult: { fontSize: Typography.small, fontWeight: '700', marginTop: Spacing.xs },
  historyXp: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' },
  positive: { color: Colors.positive },
  negative: { color: Colors.negative },
});