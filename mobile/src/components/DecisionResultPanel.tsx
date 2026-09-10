import { StyleSheet, Text } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { SkillKey } from '@/types/progress';
import { DecisionResult } from '@/types/scenario';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

export function DecisionResultPanel({ result, skill, onNext }: { result: DecisionResult; skill: SkillKey; onNext: () => void }) {
  return (
    <SectionCard>
      <Text style={[styles.title, result.isCorrect ? styles.positive : styles.negative]}>{result.title}</Text>
      <Text style={styles.xp}>+{result.xpEarned} XP</Text>
      <Text style={styles.skill}>{skillLabels[skill]} {result.isCorrect ? '+2' : '-1'}</Text>
      <Text style={styles.lessonLabel}>LESSON</Text>
      <Text style={styles.explanation}>{result.explanation}</Text>
      <PrimaryButton onPress={onNext} variant="secondary">NEXT SCENARIO</PrimaryButton>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Typography.heading, fontWeight: '800' },
  xp: { color: Colors.text, fontSize: 28, fontWeight: '800', marginTop: Spacing.sm },
  explanation: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 23, marginVertical: Spacing.lg },
  skill: { color: Colors.accent, fontSize: Typography.body, fontWeight: '800', marginTop: Spacing.sm },
  lessonLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2, marginTop: Spacing.lg },
  positive: { color: Colors.positive },
  negative: { color: Colors.negative },
});