import { StyleSheet, Text, View } from 'react-native';

import { DecisionResultPanel } from '@/components/DecisionResultPanel';
import { PageHeading } from '@/components/PageHeading';
import { ScenarioMarketCard } from '@/components/ScenarioMarketCard';
import { ScenarioOption } from '@/components/ScenarioOption';
import { Screen } from '@/components/Screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useTrainingScenario } from '@/hooks/useTrainingScenario';

export default function TrainScreen() {
  const { currentScenario, selectedDecision, result, submitDecision, nextScenario } = useTrainingScenario();

  return (
    <Screen>
      <PageHeading eyebrow="TRAINING SCENARIO" title={currentScenario.market} />
      <View style={styles.scenarioHeader}>
        <Text style={styles.scenarioLabel}>Market conditions</Text>
        <Text style={styles.badge}>{currentScenario.difficulty}</Text>
      </View>
      <ScenarioMarketCard scenario={currentScenario} />
      <Text style={styles.question}>{currentScenario.question}</Text>
      <View style={styles.options}>
        {currentScenario.options.map((option) => (
          <ScenarioOption
            key={option.id}
            decision={option.id}
            label={option.label}
            selected={selectedDecision === option.id}
            correct={Boolean(result?.isCorrect && option.id === currentScenario.correctDecision)}
            disabled={Boolean(result)}
            onPress={() => submitDecision(option.id)}
          />
        ))}
      </View>
      {result && <DecisionResultPanel result={result} onNext={nextScenario} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scenarioHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  scenarioLabel: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  badge: { backgroundColor: Colors.secondaryCard, borderRadius: Radius.pill, color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700', overflow: 'hidden', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  question: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  options: { gap: Spacing.sm },
});