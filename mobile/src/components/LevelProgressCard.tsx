import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { ProgressSummary } from '@/types/progress';
import { ProgressBar } from './ProgressBar';
import { SectionCard } from './SectionCard';
import { AppIcon } from './AppIcon';

interface LevelProgressCardProps {
  summary: ProgressSummary;
  totalXp: number;
  showTotalXp?: boolean;
  dailyStreak?: number;
}

export function LevelProgressCard({ summary, totalXp, showTotalXp = true, dailyStreak }: LevelProgressCardProps) {
  return (
    <SectionCard>
      <View style={styles.heading}>
        <View style={styles.headingIdentity}><AppIcon accessibilityLabel="Current level" name={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }} badge /><View><Text style={styles.label}>CURRENT LEVEL</Text><Text style={styles.level}>Level {summary.level}</Text></View></View>
        {dailyStreak !== undefined ? <View style={styles.streak}><AppIcon accessibilityLabel="Daily streak" name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} size={16} tintColor={Colors.warning} /><Text style={styles.streakValue}>{dailyStreak} days</Text></View> : showTotalXp ? <Text style={styles.totalXp}>{totalXp} XP total</Text> : null}
      </View>
      <ProgressBar label={`${summary.xpIntoCurrentLevel} / ${summary.xpRequiredForNextLevel} XP`} percentage={summary.progressPercentage} />
      <Text style={styles.remaining}>{summary.xpToNextLevel} XP to Level {summary.level + 1}</Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  headingIdentity: { alignItems: 'center', flexDirection: 'row', gap: Spacing.md },
  streak: { alignItems: 'center', flexDirection: 'row', gap: Spacing.xs },
  streakValue: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  label: { color: Colors.accent, fontSize: Typography.label, fontWeight: '800', letterSpacing: 1.2 },
  level: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900', marginTop: Spacing.xs },
  totalXp: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  remaining: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.md },
});