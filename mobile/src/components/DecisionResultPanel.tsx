import { StyleSheet, Text } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { DecisionResult } from '@/types/scenario';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

export function DecisionResultPanel({ result, onNext }: { result: DecisionResult; onNext: () => void }) {
  return (
    <SectionCard>
      <Text style={[styles.title, result.isCorrect ? styles.positive : styles.negative]}>{result.title}</Text>
      <Text style={styles.xp}>+{result.xpEarned} XP</Text>
      <Text style={styles.explanation}>{result.explanation}</Text>
      <PrimaryButton onPress={onNext} variant="secondary">NEXT SCENARIO</PrimaryButton>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Typography.heading, fontWeight: '800' },
  xp: { color: Colors.text, fontSize: 28, fontWeight: '800', marginTop: Spacing.sm },
  explanation: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 23, marginVertical: Spacing.lg },
  positive: { color: Colors.positive },
  negative: { color: Colors.negative },
});