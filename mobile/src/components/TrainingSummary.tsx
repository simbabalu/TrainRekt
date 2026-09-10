import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { TrainingProgressSnapshot } from '@/types/progress';
import { StatCard } from './StatCard';
import type { AppIconName } from './AppIcon';

export function TrainingSummary({ progress }: { progress: TrainingProgressSnapshot }) {
  const icons: Record<string, AppIconName> = {
    Sessions: { ios: 'figure.run', android: 'fitness_center', web: 'fitness_center' },
    Accuracy: { ios: 'scope', android: 'target', web: 'target' },
    'Correct streak': { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  };
  return <View style={styles.container}><StatCard iconName={icons.Sessions} label="Sessions" value={String(progress.sessionsCompleted)} /><StatCard iconName={icons.Accuracy} label="Accuracy" value={`${progress.winRate}%`} /><StatCard iconName={icons['Correct streak']} label="Correct streak" value={String(progress.currentStreak)} /></View>;
}

const styles = StyleSheet.create({ container: { flexDirection: 'row', gap: Spacing.sm } });