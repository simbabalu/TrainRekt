import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { RedFlagIdentificationAnswer, RedFlagIdentificationExercise } from '@/types/exercise';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

interface RedFlagIdentificationViewProps {
  exercise: RedFlagIdentificationExercise;
  disabled: boolean;
  onSelect: (answer: RedFlagIdentificationAnswer) => void;
}

const sourceTypeLabel: Record<RedFlagIdentificationExercise['scenario']['sourceType'], string> = {
  website: 'Website',
  message: 'Message',
  'support-chat': 'Support chat',
  airdrop: 'Airdrop',
  'nft-claim': 'NFT claim',
  'wallet-warning': 'Wallet notice',
  'social-post': 'Social post',
  other: 'Other',
};

export function RedFlagIdentificationView({ exercise, disabled, onSelect }: RedFlagIdentificationViewProps) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  function toggle(itemId: string) {
    if (disabled) return;
    setSelectedIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  }

  function handleCheckAnswer() {
    if (disabled) return;
    onSelect({ selectedRedFlagIds: selectedIds });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{exercise.title}</Text>
      <Text style={styles.description}>{exercise.description}</Text>

      <SectionCard>
        <Text style={styles.sectionHeading}>SCENARIO</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>Source type</Text><Text style={styles.rowValue}>{sourceTypeLabel[exercise.scenario.sourceType]}</Text></View>
        {exercise.scenario.senderOrApp ? <View style={styles.row}><Text style={styles.rowLabel}>Sender/App</Text><Text style={styles.rowValue}>{exercise.scenario.senderOrApp}</Text></View> : null}
        {exercise.scenario.displayedDomain ? <View style={styles.row}><Text style={styles.rowLabel}>Domain</Text><Text style={styles.rowValue}>{exercise.scenario.displayedDomain}</Text></View> : null}
        {exercise.scenario.headline ? <><Text style={styles.detailLabel}>Headline</Text><Text style={styles.bodyText}>{exercise.scenario.headline}</Text></> : null}
        {exercise.scenario.body ? <><Text style={styles.detailLabel}>Message</Text><Text style={styles.bodyText}>{exercise.scenario.body}</Text></> : null}
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionHeading}>OBSERVED ITEMS</Text>
        <View style={styles.itemList}>
          {exercise.scenario.observableItems.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled }}
                accessibilityLabel={`Selectable item ${item.label}`}
                disabled={disabled}
                onPress={() => toggle(item.id)}
                hitSlop={6}
                pressRetentionOffset={16}
                style={({ pressed }) => [
                  styles.itemCard,
                  selected && styles.itemCardSelected,
                  disabled && styles.itemCardDisabled,
                  pressed && !disabled && styles.itemCardPressed,
                ]}
              >
                <View style={styles.itemHeader}>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    <Text style={styles.checkboxMark}>{selected ? '✓' : ' '}</Text>
                  </View>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </View>
                <Text style={styles.itemDetail}>{item.detail}</Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <PrimaryButton disabled={disabled} onPress={handleCheckAnswer}>CHECK ANSWER</PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900' },
  description: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: TypographyLineHeight.body },
  sectionHeading: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  detailLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '800', marginTop: Spacing.sm },
  row: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  rowLabel: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  rowValue: { color: Colors.text, flexShrink: 1, fontFamily: 'monospace', fontSize: Typography.small, fontWeight: '700', marginLeft: Spacing.sm, textAlign: 'right' },
  bodyText: { color: Colors.text, fontSize: Typography.small, lineHeight: TypographyLineHeight.small, marginTop: Spacing.xs },
  itemList: { gap: Spacing.sm, marginTop: Spacing.sm },
  itemCard: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 76,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  itemCardSelected: { backgroundColor: Colors.card, borderColor: Colors.text, borderWidth: 2 },
  itemCardDisabled: { opacity: 0.7 },
  itemCardPressed: { backgroundColor: '#232C3E' },
  itemHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm },
  checkbox: {
    alignItems: 'center',
    borderColor: Colors.mutedText,
    borderRadius: 4,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  checkboxSelected: { backgroundColor: Colors.text, borderColor: Colors.text },
  checkboxMark: { color: Colors.background, fontSize: 12, fontWeight: '900', lineHeight: 14 },
  itemLabel: { color: Colors.text, flex: 1, fontSize: Typography.small, fontWeight: '800', lineHeight: TypographyLineHeight.small },
  itemDetail: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small, marginTop: Spacing.xs },
});
