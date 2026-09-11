import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import type { WalletInspectionSummary } from '@/types/walletInspection';

interface WalletInspectionEducationDetailsProps {
  summary: WalletInspectionSummary;
}

export function WalletInspectionEducationDetails({ summary }: WalletInspectionEducationDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.trigger}
      >
        <View>
          <Text style={styles.title}>ABOUT THIS INSPECTION</Text>
          <Text style={styles.triggerLabel}>{expanded ? 'Hide how these signals work' : 'Learn how these signals work'}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '^' : '>'}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.details}>
          <Text style={styles.detailTitle}>WHY THIS MATTERS</Text>
          <Text style={styles.detailText}>
            Wallet permissions and token-account configuration are visible on-chain. Reviewing them can help you notice unexpected authorities or unusual account states.
          </Text>
          <Text style={styles.detailTitle}>REMEMBER</Text>
          <Text style={styles.detailText}>
            Signals are educational prompts, not proof that an asset is a scam. The absence of signals does not prove safety.
          </Text>
          <Text style={styles.detailTitle}>TECHNICAL SIGNALS</Text>
          <Text style={styles.detailText}>
            Frozen: {summary.frozenTokenAccounts}  |  Delegated: {summary.delegatedTokenAccounts}  |  Token-2022: {summary.token2022TokenAccounts}  |  Empty: {summary.emptyTokenAccounts}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: 10,
    borderWidth: 1,
  },
  trigger: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  title: {
    color: Colors.accent,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  triggerLabel: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    marginTop: Spacing.xs,
  },
  chevron: {
    color: Colors.accent,
    fontSize: Typography.heading,
    fontWeight: '800',
  },
  details: {
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  detailTitle: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  detailText: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
});
