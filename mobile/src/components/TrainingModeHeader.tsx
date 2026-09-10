import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { DailyTrainingStep } from '@/domain/training/getDailyTrainingStep';
import { TrainingMode } from '@/types/training';
import { ProgressBar } from './ProgressBar';

interface TrainingModeHeaderProps {
  mode: TrainingMode;
  step: DailyTrainingStep;
}

export function TrainingModeHeader({ mode, step }: TrainingModeHeaderProps) {
  if (mode === 'practice') {
    return <View style={styles.container}><Text style={styles.eyebrow}>EXTRA PRACTICE</Text></View>;
  }

  const percentage = step.totalSteps === 0 ? 0 : Math.round(((step.currentStep - 1) / step.totalSteps) * 100);
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>DAILY TRAINING</Text>
      <ProgressBar label={`Decision ${step.currentStep} of ${step.totalSteps}`} percentage={percentage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomColor: Colors.border, borderBottomWidth: 1, gap: Spacing.sm, paddingBottom: Spacing.md },
  eyebrow: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2 },
});
