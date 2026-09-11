import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';

interface PrimaryButtonProps extends PropsWithChildren { onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; }

export function PrimaryButton({ children, onPress, disabled = false, variant = 'primary' }: PrimaryButtonProps) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, variant === 'secondary' && styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{children}</Text></Pressable>;
}

const styles = StyleSheet.create({ button: { alignItems: 'center', backgroundColor: Colors.accent, borderRadius: Radius.md, minHeight: 52, justifyContent: 'center', paddingHorizontal: Spacing.lg }, secondary: { backgroundColor: Colors.secondaryCard, borderColor: Colors.border, borderWidth: 1 }, label: { color: Colors.text, fontSize: Typography.body, lineHeight: TypographyLineHeight.body, fontWeight: '800', letterSpacing: 0.5 }, secondaryLabel: { color: Colors.secondaryText }, disabled: { opacity: 0.65 }, pressed: { opacity: 0.8 } });