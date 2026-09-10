import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { DecisionExercise, TrainingExerciseResult } from '@/types/exercise';
import { DecisionId } from '@/types/scenario';
import { ScenarioMarketCard } from './ScenarioMarketCard';
import { ScenarioOption } from './ScenarioOption';

interface DecisionExerciseViewProps {
  exercise: DecisionExercise;
  selectedAnswer: DecisionId | null;
  result: TrainingExerciseResult | null;
  onSelect: (decision: DecisionId) => void;
}

export function DecisionExerciseView({ exercise, selectedAnswer, result, onSelect }: DecisionExerciseViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{exercise.title}</Text>
      <ScenarioMarketCard scenario={exercise} />
      <Text style={styles.question}>{exercise.question}</Text>
      <View style={styles.options}>
        {exercise.options.map((option) => (
          <ScenarioOption
            key={option.id}
            decision={option.id}
            label={option.label}
            selected={selectedAnswer === option.id}
            correct={Boolean(result?.isCorrect && option.id === exercise.correctOptionId)}
            disabled={Boolean(result)}
            onPress={() => onSelect(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900' },
  question: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  options: { gap: Spacing.sm },
});
