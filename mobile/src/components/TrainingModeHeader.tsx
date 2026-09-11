import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { DailyTrainingStep } from '@/domain/training/getDailyTrainingStep';
import { TrainingMode } from '@/types/training';
import { ProgressBar } from './ProgressBar';
import { AppIcon } from './AppIcon';

interface TrainingModeHeaderProps {
  mode: TrainingMode;
  step: DailyTrainingStep;
}

export function TrainingModeHeader({ mode, step }: TrainingModeHeaderProps) {
  if (mode === 'practice') {
    return <View style={styles.container}><View style={styles.modeRow}><AppIcon accessibilityLabel="Extra practice" name={{ ios: 'graduationcap.fill', android: 'school', web: 'school' }} size={16} /><Text style={styles.eyebrow}>EXTRA PRACTICE</Text></View></View>;
  }

  const label = step.isComplete
    ? `${step.currentStep} / ${step.totalSteps} COMPLETE`
    : `Decision ${step.currentStep} of ${step.totalSteps}`;
  return (
    <View style={styles.container}>
      <View style={styles.modeRow}><AppIcon accessibilityLabel="Daily training" name={{ ios: 'calendar.badge.checkmark', android: 'event_available', web: 'event_available' }} size={16} /><Text style={styles.eyebrow}>DAILY TRAINING</Text></View>
      <ProgressBar label={label} percentage={step.percentage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomColor: Colors.border, borderBottomWidth: 1, gap: Spacing.sm, paddingBottom: Spacing.md },
  modeRow: { alignItems: 'center', flexDirection: 'row' },
  eyebrow: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2 },
});
