import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { SignatureDecision, SignatureSimulationExercise } from '@/types/exercise';
import { PrimaryButton } from './PrimaryButton';
import { SignatureSimulationCard } from './SignatureSimulationCard';

interface SignatureSimulationViewProps {
  exercise: SignatureSimulationExercise;
  disabled: boolean;
  onSelect: (decision: SignatureDecision) => void;
}

export function SignatureSimulationView({ exercise, disabled, onSelect }: SignatureSimulationViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{exercise.title}</Text>
      <Text style={styles.description}>{exercise.description}</Text>
      <SignatureSimulationCard exercise={exercise} />
      <Text style={styles.question}>What do you do with this request?</Text>
      <View style={styles.actions}>
        <View style={styles.actionButton}><PrimaryButton variant="secondary" disabled={disabled} onPress={() => onSelect('reject')}>REJECT</PrimaryButton></View>
        <View style={styles.actionButton}><PrimaryButton disabled={disabled} onPress={() => onSelect('sign')}>SIGN</PrimaryButton></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900' },
  description: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 22 },
  question: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { flex: 1 },
});
