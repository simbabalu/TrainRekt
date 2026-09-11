import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { ScamDetectionDecision, ScamDetectionExercise } from '@/types/exercise';

interface ScamDetectionViewProps {
  exercise: ScamDetectionExercise;
  disabled: boolean;
  onSelect: (decision: ScamDetectionDecision) => void;
}

const sourceTypeLabels: Record<ScamDetectionExercise['scenario']['sourceType'], string> = {
  website: 'Website',
  message: 'Message',
  'support-chat': 'Support chat',
  airdrop: 'Airdrop',
  'nft-claim': 'NFT claim',
  'wallet-warning': 'Wallet warning',
  'social-post': 'Social post',
  other: 'Other',
};

export function ScamDetectionView({ exercise, disabled, onSelect }: ScamDetectionViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{exercise.title}</Text>
      <Text style={styles.description}>{exercise.description}</Text>

      <View style={styles.card} accessibilityLabel="Scam detection scenario">
        <Text style={styles.sectionHeading}>SCENARIO</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Source type</Text>
          <Text style={styles.rowValue}>{sourceTypeLabels[exercise.scenario.sourceType]}</Text>
        </View>
        {exercise.scenario.senderOrApp && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Sender or app</Text>
            <Text style={styles.rowValue}>{exercise.scenario.senderOrApp}</Text>
          </View>
        )}
        {exercise.scenario.displayedDomain && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Displayed domain</Text>
            <Text style={styles.rowValue}>{exercise.scenario.displayedDomain}</Text>
          </View>
        )}
        {exercise.scenario.destinationDomain && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Destination domain</Text>
            <Text style={styles.rowValue}>{exercise.scenario.destinationDomain}</Text>
          </View>
        )}
        {exercise.scenario.headline && (
          <>
            <View style={styles.divider} />
            <Text style={styles.cardLabel}>HEADLINE</Text>
            <Text style={styles.bodyValue}>{exercise.scenario.headline}</Text>
          </>
        )}
        {exercise.scenario.message && (
          <>
            <Text style={styles.cardLabel}>MESSAGE</Text>
            <Text style={styles.bodyValue}>{exercise.scenario.message}</Text>
          </>
        )}
        <View style={styles.divider} />
        <Text style={styles.cardLabel}>OBSERVED FACTS</Text>
        <View style={styles.factList}>
          {exercise.scenario.neutralFacts.map((fact) => (
            <View key={fact} style={styles.factRow}>
              <Text style={styles.bullet}>-</Text>
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.question}>How would you classify this?</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Classify as safe"
          disabled={disabled}
          onPress={() => onSelect('safe')}
          style={({ pressed }) => [styles.actionButton, disabled && styles.actionDisabled, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>SAFE</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Classify as suspicious"
          disabled={disabled}
          onPress={() => onSelect('suspicious')}
          style={({ pressed }) => [styles.actionButton, disabled && styles.actionDisabled, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>SUSPICIOUS</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Classify as scam"
          disabled={disabled}
          onPress={() => onSelect('scam')}
          style={({ pressed }) => [styles.actionButton, disabled && styles.actionDisabled, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>SCAM</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900' },
  description: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 20, marginBottom: Spacing.xs },
  card: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 10, borderWidth: 1, gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  sectionHeading: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8, marginBottom: Spacing.xs },
  cardLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  row: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 },
  rowLabel: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  rowValue: { color: Colors.text, flexShrink: 1, fontFamily: 'monospace', fontSize: Typography.small, fontWeight: '700', marginLeft: Spacing.sm, textAlign: 'right' },
  divider: { backgroundColor: Colors.border, height: 1, marginVertical: Spacing.xs },
  bodyValue: { color: Colors.text, fontSize: Typography.small, lineHeight: 18 },
  factList: { gap: Spacing.xs },
  factRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.xs },
  bullet: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: 20 },
  factText: { color: Colors.text, flex: 1, fontSize: Typography.small, lineHeight: 18 },
  question: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800', marginTop: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { alignItems: 'center', backgroundColor: Colors.secondaryCard, borderColor: Colors.border, borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: Spacing.xs },
  actionLabel: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 0.3 },
  actionDisabled: { opacity: 0.65 },
  actionPressed: { opacity: 0.8 },
});
