import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { TrainingProgressSnapshot } from '@/types/progress';
import { StatCard } from './StatCard';

export function TrainingSummary({ progress }: { progress: TrainingProgressSnapshot }) {
  return <View style={styles.container}><StatCard label="Sessions" value={String(progress.sessionsCompleted)} /><StatCard label="Accuracy" value={`${progress.winRate}%`} /><StatCard label="Correct streak" value={String(progress.currentStreak)} /></View>;
}

const styles = StyleSheet.create({ container: { flexDirection: 'row', gap: Spacing.sm } });