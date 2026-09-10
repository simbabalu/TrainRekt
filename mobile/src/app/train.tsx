import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DailyGoalInlineStatus } from '@/components/DailyGoalInlineStatus';
import { DailyTrainingCompleteCard } from '@/components/DailyTrainingCompleteCard';
import { DecisionExerciseView } from '@/components/DecisionExerciseView';
import { DecisionResultPanel } from '@/components/DecisionResultPanel';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SignatureSimulationView } from '@/components/SignatureSimulationView';
import { TransactionInspectionView } from '@/components/TransactionInspectionView';
import { TrainingModeHeader } from '@/components/TrainingModeHeader';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { exerciseTypeLabels } from '@/constants/training';
import { calculateDailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { getDailyTrainingStep } from '@/domain/training/getDailyTrainingStep';
import { isDailyTrainingComplete } from '@/domain/training/isDailyTrainingComplete';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { useTrainingScenario } from '@/hooks/useTrainingScenario';
import { DecisionId } from '@/types/scenario';
import { SignatureDecision, TransactionInspectionDecision } from '@/types/exercise';
import { isTrainingMode, TrainingMode } from '@/types/training';

export default function TrainScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = isTrainingMode(params.mode) ? params.mode : 'daily';
  // Remount on mode change so a fresh exercise/result replaces any stale answered state.
  return <TrainSession key={mode} mode={mode} />;
}

function TrainSession({ mode }: { mode: TrainingMode }) {
  const { currentExercise, selectedAnswer, result, submitAnswer, nextExercise } = useTrainingScenario(mode);
  const { progress } = useTrainingProgress();
  const scrollRef = useRef<ScrollView>(null);
  const scrolledResultRef = useRef<typeof result>(null);
  const step = getDailyTrainingStep(progress.daily);
  const dailyGoalProgress = calculateDailyGoalProgress(progress.daily);
  const sessionComplete = isDailyTrainingComplete(progress.daily, mode);

  function handleResultAnchorLayout(event: LayoutChangeEvent) {
    if (!result || scrolledResultRef.current === result) return;
    scrolledResultRef.current = result;
    scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: true });
  }

  return (
    <Screen ref={scrollRef}>
      <TrainingModeHeader mode={mode} step={step} />
      <View style={styles.metadata}>
        <View style={styles.metadataItem}><AppIcon accessibilityLabel="Exercise type" name={{ ios: 'square.grid.2x2.fill', android: 'category', web: 'category' }} size={16} /><Text style={styles.exerciseTypeLabel}>{exerciseTypeLabels[currentExercise.type]}</Text></View>
        <View style={styles.metadataItem}><AppIcon accessibilityLabel="Difficulty" name={{ ios: 'dial.medium.fill', android: 'tune', web: 'tune' }} size={16} tintColor={Colors.mutedText} /><Text style={styles.difficulty}>{currentExercise.difficulty}</Text></View>
      </View>

      {currentExercise.type === 'decision' ? (
        <DecisionExerciseView
          exercise={currentExercise}
          selectedAnswer={selectedAnswer as DecisionId | null}
          result={result}
          onSelect={submitAnswer}
        />
      ) : currentExercise.type === 'signature-simulation' ? (
        <SignatureSimulationView
          exercise={currentExercise}
          disabled={Boolean(result)}
          onSelect={(decision: SignatureDecision) => submitAnswer(decision)}
        />
      ) : (
        <TransactionInspectionView
          exercise={currentExercise}
          disabled={Boolean(result)}
          onSelect={(decision: TransactionInspectionDecision) => submitAnswer(decision)}
        />
      )}

      {result && (
        <View onLayout={handleResultAnchorLayout}>
          <DecisionResultPanel result={result} skill={currentExercise.skill} />
          {mode === 'daily' && !sessionComplete && <DailyGoalInlineStatus goalProgress={dailyGoalProgress} />}
          {sessionComplete ? (
            <DailyTrainingCompleteCard goalProgress={dailyGoalProgress} dailyTrainingStreak={progress.daily.dailyTrainingStreak} />
          ) : (
            <PrimaryButton onPress={nextExercise} variant="secondary">NEXT EXERCISE</PrimaryButton>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  exerciseTypeLabel: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2 },
  metadata: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.xs },
  metadataItem: { alignItems: 'center', flexDirection: 'row' },
  difficulty: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
});
