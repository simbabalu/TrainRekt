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

const skillKeys: SkillKey[] = ['riskManagement', 'profitTaking', 'fomoResistance', 'positionSizing', 'scamAwareness', 'leverageRisk', 'panicSelling', 'marketInterpretation', 'walletSafety'];

export default function ProgressScreen() {
  const { progress } = useTrainingProgress();
  const stats = [['Sessions', progress.sessionsCompleted], ['Correct', progress.correctDecisions], ['Wrong', progress.wrongDecisions], ['Accuracy', `${progress.winRate}%`], ['Best streak', progress.bestStreak]] as const;
  const dailyGoalProgress = calculateDailyGoalProgress(progress.daily);

  return (
    <Screen>
      <PageHeading eyebrow="PROGRESS" title="Your training progress" />
      <LevelProgressCard summary={progress} totalXp={progress.totalXp} />
      <SectionCard><Text style={styles.sectionTitle}>TRAINING STATS</Text><View style={styles.stats}>{stats.map(([label, value]) => <View key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View><Text style={styles.currentStreak}>Current streak: {progress.currentStreak} correct</Text></SectionCard>
      <SectionCard>
        <Text style={styles.sectionTitle}>DAILY TRAINING</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{dailyGoalProgress.completed}/{dailyGoalProgress.goal}</Text><Text style={styles.statLabel}>Today&apos;s goal</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{progress.daily.dailyTrainingStreak}</Text><Text style={styles.statLabel}>Daily streak</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{progress.daily.bestDailyTrainingStreak}</Text><Text style={styles.statLabel}>Best daily streak</Text></View>
        </View>
      </SectionCard>
      <SectionCard><Text style={styles.sectionTitle}>SKILLS</Text><View style={styles.skills}>{skillKeys.map((skill) => <ProgressBar key={skill} label={skillLabels[skill]} percentage={progress.skillScores[skill]} />)}</View></SectionCard>
      <SectionCard><Text style={styles.sectionTitle}>RECENT TRAINING</Text><View style={styles.history}>{progress.recentTrainingHistory.slice(0, 3).map((entry) => <View key={entry.id} style={styles.historyRow}><View style={styles.historyMain}><Text style={styles.historyTitle}>{entry.scenarioTitle}</Text><Text style={[styles.historyResult, entry.correct ? styles.positive : styles.negative]}>{entry.correct ? 'Correct' : 'Wrong'}  •  {skillLabels[entry.skill]}</Text></View><Text style={styles.historyXp}>+{entry.xpEarned} XP</Text></View>)}</View></SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2 },
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