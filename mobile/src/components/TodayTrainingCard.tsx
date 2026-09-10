import { StyleSheet, Text } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { TrainingScenario } from '@/types/scenario';
import { ScenarioContextChips } from './ScenarioContextChips';
import { SectionCard } from './SectionCard';

export function TodayTrainingCard({ scenario }: { scenario: TrainingScenario }) {
  return <SectionCard><Text style={styles.title}>{scenario.title}</Text><Text style={styles.description}>{scenario.description}</Text><Text style={styles.meta}>Skill: {skillLabels[scenario.skill]}</Text><Text style={styles.meta}>{scenario.difficulty}  •  {scenario.estimatedDuration}  •  +{scenario.xpReward} XP</Text><ScenarioContextChips context={scenario.marketContext} limit={3} /></SectionCard>;
}

const styles = StyleSheet.create({
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  description: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 22, marginTop: Spacing.sm },
  meta: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700', marginTop: Spacing.md },
});