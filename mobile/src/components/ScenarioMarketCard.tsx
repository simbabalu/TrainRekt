import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { MarketMetric, TrainingScenario } from '@/types/scenario';
import { SectionCard } from './SectionCard';

export function ScenarioMarketCard({ scenario }: { scenario: TrainingScenario }) {
  return (
    <SectionCard>
      <Text style={styles.prompt}>{scenario.prompt}</Text>
      <View style={styles.metrics}>
        {scenario.metrics.map((metric) => <MarketMetricView key={metric.label} metric={metric} />)}
      </View>
    </SectionCard>
  );
}

function MarketMetricView({ metric }: { metric: MarketMetric }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={[styles.metricValue, metric.tone === 'positive' && styles.positive, metric.tone === 'negative' && styles.negative]}>{metric.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { color: Colors.text, fontSize: Typography.body, lineHeight: 24 },
  metrics: { borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.lg, paddingTop: Spacing.lg, rowGap: Spacing.lg },
  metric: { width: '33%' },
  metricLabel: { color: Colors.mutedText, fontSize: Typography.label, marginBottom: Spacing.xs },
  metricValue: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' },
  positive: { color: Colors.positive },
  negative: { color: Colors.negative },
});