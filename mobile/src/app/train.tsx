import { StyleSheet, Text, View } from 'react-native';

import { DecisionResultPanel } from '@/components/DecisionResultPanel';
import { PageHeading } from '@/components/PageHeading';
import { ScenarioMarketCard } from '@/components/ScenarioMarketCard';
import { ScenarioOption } from '@/components/ScenarioOption';
import { Screen } from '@/components/Screen';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { useTrainingScenario } from '@/hooks/useTrainingScenario';

export default function TrainScreen() {
  const { currentScenario, selectedDecision, result, submitDecision, nextScenario } = useTrainingScenario();

  return (
    <Screen>
      <PageHeading eyebrow="TRAINING SCENARIO" title="Decision exercise" />
      <View style={styles.metadata}><Text style={styles.skill}>Skill: {skillLabels[currentScenario.skill]}</Text><Text style={styles.difficulty}>{currentScenario.difficulty}</Text></View>
      <Text style={styles.title}>{currentScenario.title}</Text>
      <ScenarioMarketCard scenario={currentScenario} />
      <Text style={styles.question}>{currentScenario.question}</Text>
      <View style={styles.options}>{currentScenario.options.map((option) => <ScenarioOption key={option.id} decision={option.id} label={option.label} selected={selectedDecision === option.id} correct={Boolean(result?.isCorrect && option.id === currentScenario.correctOptionId)} disabled={Boolean(result)} onPress={() => submitDecision(option.id)} />)}</View>
      {result && <DecisionResultPanel result={result} skill={currentScenario.skill} onNext={nextScenario} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metadata: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  skill: { color: Colors.accent, fontSize: Typography.body, fontWeight: '800' },
  difficulty: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900' },
  question: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800', marginTop: Spacing.sm },
  options: { gap: Spacing.sm },
});