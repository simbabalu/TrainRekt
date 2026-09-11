import { StyleSheet, Text } from 'react-native';

import { Colors, Typography, TypographyLineHeight } from '@/constants/theme';
import { TrainingScenario } from '@/types/scenario';
import { ScenarioContextChips } from './ScenarioContextChips';
import { SectionCard } from './SectionCard';

export function ScenarioMarketCard({ scenario }: { scenario: TrainingScenario }) {
  return (
    <SectionCard>
      <Text style={styles.description}>{scenario.description}</Text>
      <ScenarioContextChips context={scenario.marketContext} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  description: { color: Colors.text, fontSize: Typography.body, lineHeight: TypographyLineHeight.body },
});