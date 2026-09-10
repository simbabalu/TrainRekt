import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { DecisionId } from '@/types/scenario';

export function ScenarioOption({ label, selected, correct, disabled, onPress }: { label: string; decision: DecisionId; selected: boolean; correct?: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.selected, correct && styles.correct, pressed && styles.pressed]}><Text style={styles.label}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({ option: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 56, paddingHorizontal: Spacing.lg }, selected: { borderColor: Colors.accent, backgroundColor: '#211A48' }, correct: { borderColor: Colors.positive, backgroundColor: '#123526' }, label: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' }, pressed: { opacity: 0.8 } });