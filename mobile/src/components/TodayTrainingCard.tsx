import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { exerciseTypeLabels, skillLabels } from '@/constants/training';
import { TrainingExercise } from '@/types/exercise';
import { ScenarioContextChips } from './ScenarioContextChips';
import { SectionCard } from './SectionCard';
import { AppIcon } from './AppIcon';

export function TodayTrainingCard({ exercise }: { exercise: TrainingExercise }) {
  return (
    <SectionCard>
      <View style={styles.typeRow}><AppIcon accessibilityLabel="Training exercise" name={{ ios: 'figure.run', android: 'fitness_center', web: 'fitness_center' }} size={16} /><Text style={styles.typeLabel}>{exerciseTypeLabels[exercise.type]}</Text></View>
      <Text style={styles.title}>{exercise.title}</Text>
      <Text style={styles.description}>{exercise.description}</Text>
      <Text style={styles.description}>{exercise.description}</Text>
      <View style={styles.metaRow}><AppIcon accessibilityLabel="Exercise details" name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={15} tintColor={Colors.mutedText} /><Text style={styles.meta}>{skillLabels[exercise.skill]}  •  {exercise.difficulty}{exercise.type === 'decision' ? `  •  ${exercise.estimatedDuration}` : ''}</Text></View>
      <View style={styles.metaRow}><AppIcon accessibilityLabel="XP reward" name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={15} tintColor={Colors.positive} /><Text style={styles.xp}>+{exercise.xpReward} XP</Text></View>
      {exercise.type === 'decision' && <ScenarioContextChips context={exercise.marketContext} limit={3} />}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  typeRow: { alignItems: 'center', flexDirection: 'row', marginBottom: Spacing.sm },
  typeLabel: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  description: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: TypographyLineHeight.body, marginTop: Spacing.sm },
  metaRow: { alignItems: 'center', flexDirection: 'row', marginTop: Spacing.md },
  meta: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  xp: { color: Colors.positive, fontSize: Typography.small, fontWeight: '800' },
});