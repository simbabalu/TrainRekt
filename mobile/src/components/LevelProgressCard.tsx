import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { ProgressSummary } from '@/types/progress';
import { ProgressBar } from './ProgressBar';
import { SectionCard } from './SectionCard';

export function LevelProgressCard({ summary, totalXp }: { summary: ProgressSummary; totalXp: number }) {
  const percentage = (summary.xpIntoCurrentLevel / summary.xpRequiredForNextLevel) * 100;

  return (
    <SectionCard>
      <View style={styles.heading}><View><Text style={styles.label}>CURRENT LEVEL</Text><Text style={styles.level}>Level {summary.level}</Text></View><Text style={styles.totalXp}>{totalXp} XP total</Text></View>
      <ProgressBar label={`${summary.xpIntoCurrentLevel} / ${summary.xpRequiredForNextLevel} XP`} percentage={percentage} />
      <Text style={styles.remaining}>{summary.xpToNextLevel} XP to next level</Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  label: { color: Colors.accent, fontSize: Typography.label, fontWeight: '800', letterSpacing: 1.2 },
  level: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900', marginTop: Spacing.xs },
  totalXp: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  remaining: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.md },
});