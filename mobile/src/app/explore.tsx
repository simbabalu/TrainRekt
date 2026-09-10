import { StyleSheet, Text, View } from 'react-native';

import { PageHeading } from '@/components/PageHeading';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { mockProgress } from '@/data/mockProgress';

const stats = [
  ['Sessions', mockProgress.sessions],
  ['Correct decisions', mockProgress.correctDecisions],
  ['Wrong decisions', mockProgress.wrongDecisions],
  ['Win rate', `${mockProgress.winRate}%`],
  ['Best streak', mockProgress.bestStreak],
] as const;

export default function ProgressScreen() {
  const progressPercentage = (mockProgress.currentXp / mockProgress.nextLevelXp) * 100;

  return (
    <Screen>
      <PageHeading eyebrow="PROGRESS" title={`Level ${mockProgress.level}`} />
      <Text style={styles.xp}>{mockProgress.currentXp} XP <Text style={styles.xpMuted}>/ {mockProgress.nextLevelXp} XP</Text></Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${progressPercentage}%` }]} /></View>

      <SectionCard>
        <Text style={styles.sectionTitle}>Training stats</Text>
        <View style={styles.stats}>
          {stats.map(([label, value]) => <View key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}
        </View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Skills</Text>
        <View style={styles.skills}>{mockProgress.skills.map((skill) => <ProgressBar key={skill.name} label={skill.name} percentage={skill.percentage} />)}</View>
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Recent history</Text>
        <View style={styles.history}>{mockProgress.history.map((entry) => <View key={entry.scenarioTitle} style={styles.historyRow}><View><Text style={styles.historyTitle}>{entry.scenarioTitle}</Text><Text style={[styles.historyResult, entry.result === 'Correct' ? styles.positive : styles.negative]}>{entry.result}</Text></View><Text style={styles.historyXp}>+{entry.xpEarned} XP</Text></View>)}</View>
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