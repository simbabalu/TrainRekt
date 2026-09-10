import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { MarketContext } from '@/types/scenario';

export function ScenarioContextChips({ context, limit }: { context: MarketContext; limit?: number }) {
  const chips = getContextChips(context).slice(0, limit);
  if (chips.length === 0) return null;
  return <View style={styles.container}>{chips.map((chip) => <View key={chip.label} style={styles.chip}><Text style={styles.label}>{chip.label}</Text><Text style={styles.value}>{chip.value}</Text></View>)}</View>;
}

export function getContextChips(context: MarketContext) {
  const availableChips: [string, string | undefined][] = [
    ['RSI', context.rsi],
    ['VOL', context.volumeChange],
    ['PNL', context.pnl],
    ['LIQUIDITY', context.liquidity],
    ['LEVERAGE', context.leverage],
    ['R/R', context.riskRewardRatio],
  ];
  return availableChips.filter((chip): chip is [string, string] => Boolean(chip[1])).map(([label, value]) => ({ label, value }));
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  chip: { backgroundColor: Colors.secondaryCard, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  label: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '700' },
  value: { color: Colors.text, fontSize: Typography.small, fontWeight: '800', marginTop: Spacing.xs },
});