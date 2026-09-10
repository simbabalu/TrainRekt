import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { TransactionInspectionDecision, TransactionInspectionExercise } from '@/types/exercise';

interface TransactionInspectionViewProps {
  exercise: TransactionInspectionExercise;
  disabled: boolean;
  onSelect: (decision: TransactionInspectionDecision) => void;
}

export function TransactionInspectionView({ exercise, disabled, onSelect }: TransactionInspectionViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{exercise.title}</Text>
      <Text style={styles.description}>{exercise.description}</Text>
      <View style={styles.card} accessibilityLabel="Request context">
        <Text style={styles.cardLabel}>REQUEST CONTEXT</Text>
        <Text style={styles.cardLabel}>REQUESTING APP</Text>
        <Text style={styles.primaryValue}>{exercise.requestingApp ?? 'Unknown'}</Text>
        <Text style={styles.monoValue}>{exercise.requestingDomain ?? 'Unknown'}</Text>
        <View style={styles.divider} />
        <Text style={styles.cardLabel}>NETWORK AND FEE</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Network</Text>
          <Text style={styles.rowValue}>{exercise.transaction.network}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Fee</Text>
          <Text style={styles.rowValue}>{exercise.transaction.feeSol.toFixed(6)} SOL</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeading}>PROGRAMS INVOKED</Text>
        {exercise.transaction.programInvocations.map((invocation) => (
          <View key={`${invocation.program}-${String(invocation.verified)}`} style={styles.programRow}>
            <Text style={styles.programName}>{invocation.program}</Text>
            <Text style={styles.programStatus}>{invocation.verified ? 'verified' : 'unverified'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeading}>INSTRUCTION SUMMARY</Text>
        {exercise.transaction.instructions.map((instruction) => (
          <View key={`${instruction.program}-${instruction.action}`} style={styles.instructionBlock}>
            <Text style={styles.instructionTitle}>{instruction.program}: {instruction.action}</Text>
            {instruction.details?.map((detail) => (
              <View key={detail} style={styles.listRow}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.listCopy}>{detail}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeading}>ASSET MOVEMENT / TOKEN TRANSFERS</Text>
        {exercise.transaction.tokenTransfers.length === 0 ? (
          <Text style={styles.emptyState}>None listed</Text>
        ) : (
          exercise.transaction.tokenTransfers.map((transfer) => (
            <View key={`${transfer.asset}-${transfer.amount}-${transfer.from}-${transfer.to}`} style={styles.transferRow}>
              <Text style={styles.transferDirection}>{transfer.direction === 'in' ? 'IN' : 'OUT'}</Text>
              <View style={styles.transferCopy}>
                <Text style={styles.transferTitle}>{transfer.amount} {transfer.asset}{transfer.isNft ? ' (NFT)' : ''}</Text>
                <Text style={styles.transferDetail}><Text style={styles.transferLabel}>From </Text>{transfer.from}</Text>
                <Text style={styles.transferDetail}><Text style={styles.transferLabel}>To </Text>{transfer.to}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeading}>ACCOUNT CHANGES</Text>
        {exercise.transaction.accountChanges.length === 0 ? (
          <Text style={styles.emptyState}>None listed</Text>
        ) : (
          exercise.transaction.accountChanges.map((change) => (
            <View key={`${change.account}-${change.change}`} style={styles.changeBlock}>
              <Text style={styles.primaryValue}>{change.change}</Text>
              <Text style={styles.monoValue}>{change.account}</Text>
              <Text style={styles.detailCopy}>{change.detail}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.question}>What is your decision?</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Approve transaction" disabled={disabled} onPress={() => onSelect('approve')} style={({ pressed }) => [styles.actionButton, disabled && styles.actionDisabled, pressed && styles.actionPressed]}>
          <Text style={styles.actionLabel}>APPROVE</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Needs review" disabled={disabled} onPress={() => onSelect('needs-review')} style={({ pressed }) => [styles.actionButton, disabled && styles.actionDisabled, pressed && styles.actionPressed]}>
          <Text style={styles.actionLabel}>NEEDS REVIEW</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Reject transaction" disabled={disabled} onPress={() => onSelect('reject')} style={({ pressed }) => [styles.actionButton, disabled && styles.actionDisabled, pressed && styles.actionPressed]}>
          <Text style={styles.actionLabel}>REJECT</Text>
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
  cardLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  sectionHeading: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8, marginBottom: Spacing.xs },
  primaryValue: { color: Colors.text, fontSize: Typography.small, fontWeight: '800', lineHeight: 18 },
  monoValue: { color: Colors.secondaryText, fontFamily: 'monospace', fontSize: Typography.small, lineHeight: 18 },
  divider: { backgroundColor: Colors.border, height: 1, marginVertical: Spacing.xs },
  row: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 },
  rowLabel: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  rowValue: { color: Colors.text, flexShrink: 1, fontFamily: 'monospace', fontSize: Typography.small, fontWeight: '700', marginLeft: Spacing.sm, textAlign: 'right' },
  listRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.xs },
  bullet: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: 20 },
  listCopy: { color: Colors.text, flex: 1, fontSize: Typography.small, lineHeight: 18 },
  programRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  programName: { color: Colors.text, flex: 1, fontFamily: 'monospace', fontSize: Typography.small, lineHeight: 18 },
  programStatus: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: 18 },
  instructionBlock: { gap: 2, marginBottom: Spacing.xs },
  instructionTitle: { color: Colors.text, fontSize: Typography.small, fontWeight: '800', lineHeight: 18 },
  transferRow: { alignItems: 'flex-start', borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm },
  transferDirection: { color: Colors.secondaryText, fontSize: Typography.label, fontWeight: '900', marginTop: 2, minWidth: 30 },
  transferCopy: { flex: 1 },
  transferTitle: { color: Colors.text, fontSize: Typography.small, fontWeight: '800', lineHeight: 18 },
  transferDetail: { color: Colors.secondaryText, fontFamily: 'monospace', fontSize: Typography.small, lineHeight: 18 },
  transferLabel: { color: Colors.mutedText, fontFamily: 'sans-serif', fontWeight: '700' },
  changeBlock: { borderTopColor: Colors.border, borderTopWidth: 1, gap: 1, paddingTop: Spacing.sm },
  detailCopy: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: 18 },
  emptyState: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: 18 },
  question: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800', marginTop: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: { alignItems: 'center', backgroundColor: Colors.secondaryCard, borderColor: Colors.border, borderRadius: 10, borderWidth: 1, flex: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: Spacing.xs },
  actionLabel: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 0.3 },
  actionDisabled: { opacity: 0.65 },
  actionPressed: { opacity: 0.8 },
});
