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
import { ScamDetectionView } from '@/components/ScamDetectionView';
import { RedFlagIdentificationView } from '@/components/RedFlagIdentificationView';
import { TransactionInspectionView } from '@/components/TransactionInspectionView';
import { PermissionChallengeView } from '@/components/PermissionChallengeView';
import { TrainingModeHeader } from '@/components/TrainingModeHeader';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { exerciseTypeLabels } from '@/constants/training';
import { calculateDailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { getDailyTrainingStep } from '@/domain/training/getDailyTrainingStep';
import { isDailyTrainingComplete } from '@/domain/training/isDailyTrainingComplete';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { useTrainingScenario } from '@/hooks/useTrainingScenario';
import { exerciseCatalog } from '@/data/exerciseCatalog';
import { permissionChallengeCatalog } from '@/data/permissionChallengeCatalog';
import { redFlagIdentificationCatalog } from '@/data/redFlagIdentificationCatalog';
import { scamDetectionCatalog } from '@/data/scamDetectionCatalog';
import { transactionInspectionCatalog } from '@/data/transactionInspectionCatalog';
import { SectionCard } from '@/components/SectionCard';
import { DecisionId } from '@/types/scenario';
import { PermissionChallengeDecision, RedFlagIdentificationAnswer, ScamDetectionDecision, SignatureDecision, TransactionInspectionDecision, TrainingExercise, TrainingExerciseResult } from '@/types/exercise';
import { isTrainingMode, TrainingMode } from '@/types/training';

export default function TrainScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = isTrainingMode(params.mode) ? params.mode : 'daily';
  // Remount on mode change so a fresh exercise/result replaces any stale answered state.
  return <TrainSession key={mode} mode={mode} />;
}

function TrainSession({ mode }: { mode: TrainingMode }) {
  const { currentExercise, selectedAnswer, result, submitAnswer, nextExercise, debugSelectExercise } = useTrainingScenario(mode);
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

  function scrollToTopAfterExerciseChange() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }

  function handleNextExercise() {
    nextExercise();
    scrollToTopAfterExerciseChange();
  }

  function handleDebugSelectExercise(exerciseId: string) {
    debugSelectExercise(exerciseId);
    scrollToTopAfterExerciseChange();
  }

  const firstDecision = exerciseCatalog.find((exercise) => exercise.type === 'decision');
  const firstSignature = exerciseCatalog.find((exercise) => exercise.type === 'signature-simulation');
  const firstTransactionInspection = exerciseCatalog.find((exercise) => exercise.type === 'transaction-inspection');
  const firstPermissionChallenge = exerciseCatalog.find((exercise) => exercise.type === 'permission-challenge');
  const firstScamDetection = exerciseCatalog.find((exercise) => exercise.type === 'scam-detection');
  const firstRedFlagIdentification = exerciseCatalog.find((exercise) => exercise.type === 'red-flag-identification');

  return (
    <Screen ref={scrollRef}>
      <TrainingModeHeader mode={mode} step={step} />
      <View style={styles.metadata}>
        <View style={styles.metadataItem}><AppIcon accessibilityLabel="Exercise type" name={{ ios: 'square.grid.2x2.fill', android: 'category', web: 'category' }} size={16} /><Text style={styles.exerciseTypeLabel}>{exerciseTypeLabels[currentExercise.type]}</Text></View>
        <View style={styles.metadataItem}><AppIcon accessibilityLabel="Difficulty" name={{ ios: 'dial.medium.fill', android: 'tune', web: 'tune' }} size={16} tintColor={Colors.mutedText} /><Text style={styles.difficulty}>{currentExercise.difficulty}</Text></View>
      </View>

      {renderExerciseByType(currentExercise, selectedAnswer as DecisionId | null, result, submitAnswer)}

      {result && (
        <View onLayout={handleResultAnchorLayout}>
          <DecisionResultPanel result={result} skill={currentExercise.skill} />
          {mode === 'daily' && !sessionComplete && <DailyGoalInlineStatus goalProgress={dailyGoalProgress} />}
          {sessionComplete ? (
            <DailyTrainingCompleteCard goalProgress={dailyGoalProgress} dailyTrainingStreak={progress.daily.dailyTrainingStreak} />
          ) : (
            <PrimaryButton onPress={handleNextExercise} variant="secondary">NEXT EXERCISE</PrimaryButton>
          )}
        </View>
      )}

      {__DEV__ && (
        <SectionCard>
          <Text style={styles.devTitle}>DEV EXERCISE PICKER</Text>
          <Text style={styles.devSubtitle}>Loads the selected exercise through the normal Train session path.</Text>
          <View style={styles.devButtons}>
            {firstDecision && <PrimaryButton variant="secondary" onPress={() => handleDebugSelectExercise(firstDecision.id)}>Load decision</PrimaryButton>}
            {firstSignature && <PrimaryButton variant="secondary" onPress={() => handleDebugSelectExercise(firstSignature.id)}>Load signature</PrimaryButton>}
            {firstTransactionInspection && <PrimaryButton variant="secondary" onPress={() => handleDebugSelectExercise(firstTransactionInspection.id)}>Load transaction inspection</PrimaryButton>}
            {firstPermissionChallenge && <PrimaryButton variant="secondary" onPress={() => handleDebugSelectExercise(firstPermissionChallenge.id)}>Load permission challenge</PrimaryButton>}
            {firstScamDetection && <PrimaryButton variant="secondary" onPress={() => handleDebugSelectExercise(firstScamDetection.id)}>Load scam detection</PrimaryButton>}
            {firstRedFlagIdentification && <PrimaryButton variant="secondary" onPress={() => handleDebugSelectExercise(firstRedFlagIdentification.id)}>Load red flag identification</PrimaryButton>}
            {transactionInspectionCatalog.map((exercise) => (
              <PrimaryButton key={exercise.id} variant="secondary" onPress={() => handleDebugSelectExercise(exercise.id)}>TX: {exercise.title}</PrimaryButton>
            ))}
            {permissionChallengeCatalog.map((exercise) => (
              <PrimaryButton key={exercise.id} variant="secondary" onPress={() => handleDebugSelectExercise(exercise.id)}>Permission: {exercise.title}</PrimaryButton>
            ))}
            {scamDetectionCatalog.map((exercise) => (
              <PrimaryButton key={exercise.id} variant="secondary" onPress={() => handleDebugSelectExercise(exercise.id)}>Scam: {exercise.title}</PrimaryButton>
            ))}
            {redFlagIdentificationCatalog.map((exercise) => (
              <PrimaryButton key={exercise.id} variant="secondary" onPress={() => handleDebugSelectExercise(exercise.id)}>Red Flags: {exercise.title}</PrimaryButton>
            ))}
          </View>
        </SectionCard>
      )}
    </Screen>
  );
}

function renderExerciseByType(
  currentExercise: TrainingExercise,
  selectedAnswer: DecisionId | null,
  result: TrainingExerciseResult | null,
  submitAnswer: (decision: DecisionId | SignatureDecision | TransactionInspectionDecision | PermissionChallengeDecision | ScamDetectionDecision | RedFlagIdentificationAnswer) => void,
) {
  switch (currentExercise.type) {
    case 'decision':
      return (
        <DecisionExerciseView
          exercise={currentExercise}
          selectedAnswer={selectedAnswer}
          result={result}
          onSelect={submitAnswer}
        />
      );
    case 'signature-simulation':
      return (
        <SignatureSimulationView
          exercise={currentExercise}
          disabled={Boolean(result)}
          onSelect={(decision: SignatureDecision) => submitAnswer(decision)}
        />
      );
    case 'transaction-inspection':
      return (
        <TransactionInspectionView
          exercise={currentExercise}
          disabled={Boolean(result)}
          onSelect={(decision: TransactionInspectionDecision) => submitAnswer(decision)}
        />
      );
    case 'permission-challenge':
      return (
        <PermissionChallengeView
          exercise={currentExercise}
          disabled={Boolean(result)}
          onSelect={(decision: PermissionChallengeDecision) => submitAnswer(decision)}
        />
      );
    case 'scam-detection':
      return (
        <ScamDetectionView
          exercise={currentExercise}
          disabled={Boolean(result)}
          onSelect={(decision: ScamDetectionDecision) => submitAnswer(decision)}
        />
      );
    case 'red-flag-identification':
      return (
        <RedFlagIdentificationView
          exercise={currentExercise}
          disabled={Boolean(result)}
          onSelect={(answer: RedFlagIdentificationAnswer) => submitAnswer(answer)}
        />
      );
    default: {
      const unsupportedType: never = currentExercise;
      throw new Error(`Unsupported exercise type: ${String(unsupportedType)}`);
    }
  }
}

const styles = StyleSheet.create({
  exerciseTypeLabel: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2 },
  metadata: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.xs },
  metadataItem: { alignItems: 'center', flexDirection: 'row' },
  difficulty: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  devTitle: { color: Colors.warning, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.1 },
  devSubtitle: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  devButtons: { gap: Spacing.sm, marginTop: Spacing.md },
});
