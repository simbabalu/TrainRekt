import { StyleSheet, Text } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { exerciseTypeLabels, skillLabels } from '@/constants/training';
import { TrainingExercise } from '@/types/exercise';
import { ScenarioContextChips } from './ScenarioContextChips';
import { SectionCard } from './SectionCard';

export function TodayTrainingCard({ exercise }: { exercise: TrainingExercise }) {
  return (
    <SectionCard>
      <Text style={styles.typeLabel}>{exerciseTypeLabels[exercise.type]}</Text>
      <Text style={styles.title}>{exercise.title}</Text>
      <Text style={styles.description}>{exercise.description}</Text>
      <Text style={styles.meta}>{skillLabels[exercise.skill]}  •  {exercise.difficulty}{exercise.type === 'decision' ? `  •  ${exercise.estimatedDuration}` : ''}</Text>
      <Text style={styles.xp}>+{exercise.xpReward} XP</Text>
      {exercise.type === 'decision' && <ScenarioContextChips context={exercise.marketContext} limit={3} />}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  typeLabel: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2, marginBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  description: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 22, marginTop: Spacing.sm },
  meta: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700', marginTop: Spacing.md },
  xp: { color: Colors.positive, fontSize: Typography.small, fontWeight: '800', marginTop: Spacing.sm },
});