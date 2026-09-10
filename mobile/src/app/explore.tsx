import { StyleSheet, Text, View } from 'react-native';

import { PageHeading } from '@/components/PageHeading';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { SkillKey } from '@/types/progress';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

const skillKeys: SkillKey[] = ['riskManagement', 'profitTaking', 'fomoResistance', 'positionSizing'];

export default function ProgressScreen() {
  const { progress } = useTrainingProgress();
  const progressPercentage = (progress.xpIntoCurrentLevel / progress.xpRequiredForNextLevel) * 100;
  const stats = [
    ['Sessions', progress.sessionsCompleted],
    ['Correct decisions', progress.correctDecisions],
    ['Wrong decisions', progress.wrongDecisions],
    ['Win rate', `${progress.winRate}%`],
    ['Current streak', progress.currentStreak],
    ['Best streak', progress.bestStreak],
  ] as const;

  return (
    <Screen>
      <PageHeading eyebrow="PROGRESS" title={`Level ${progress.level}`} />
      <Text style={styles.xp}>{progress.xpIntoCurrentLevel} XP <Text style={styles.xpMuted}>/ {progress.xpRequiredForNextLevel} XP</Text></Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${progressPercentage}%` }]} /></View>

      <SectionCard>
        <Text style={styles.sectionTitle}>Training stats</Text>
        <View style={styles.stats}>
          {stats.map(([label, value]) => <View key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Skills</Text>
        <View style={styles.skills}>{skillKeys.map((skill) => <ProgressBar key={skill} label={skillLabels[skill]} percentage={progress.skillScores[skill]} />)}</View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Recent history</Text>
        <View style={styles.history}>{progress.recentTrainingHistory.slice(0, 3).map((entry) => <View key={entry.id} style={styles.historyRow}><View><Text style={styles.historyTitle}>{entry.scenarioTitle}</Text><Text style={[styles.historyResult, entry.correct ? styles.positive : styles.negative]}>{entry.correct ? 'Correct' : 'Wrong'}</Text></View><Text style={styles.historyXp}>+{entry.xpEarned} XP</Text></View>)}</View>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  xp: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  xpMuted: { color: Colors.secondaryText, fontSize: Typography.body, fontWeight: '500' },
  track: { backgroundColor: Colors.secondaryCard, borderRadius: 999, height: 8, overflow: 'hidden' },
  fill: { backgroundColor: Colors.accent, borderRadius: 999, height: '100%' },
  sectionTitle: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.lg, rowGap: Spacing.lg },
  stat: { width: '33%' },
  statValue: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  statLabel: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  skills: { gap: Spacing.lg, marginTop: Spacing.lg },
  history: { gap: Spacing.lg, marginTop: Spacing.lg },
  historyRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyTitle: { color: Colors.text, fontSize: Typography.body, fontWeight: '700' },
  historyResult: { fontSize: Typography.small, fontWeight: '700', marginTop: Spacing.xs },
  historyXp: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' },
  positive: { color: Colors.positive },
  negative: { color: Colors.negative },
});