import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Radius, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';

interface TokenAnalysisInputCardProps {
  mintInput: string;
  onChangeMint: (value: string) => void;
  validationError: string | null;
  inlineNotice?: string | null;
  deterministicStatus: 'idle' | 'validating' | 'loadingInspection' | 'loadingProvenance' | 'ready' | 'error';
  onAnalyze: () => void;
  onClear: () => void;
}

function getButtonLabel(status: TokenAnalysisInputCardProps['deterministicStatus']): string {
  if (status === 'loadingInspection') return 'ANALYZING TOKEN...';
  if (status === 'loadingProvenance') return 'LOADING PROVENANCE...';
  if (status === 'validating') return 'VALIDATING...';
  return 'ANALYZE TOKEN';
}

export function TokenAnalysisInputCard({
  mintInput,
  onChangeMint,
  validationError,
  inlineNotice = null,
  deterministicStatus,
  onAnalyze,
  onClear,
}: TokenAnalysisInputCardProps) {
  const isBusy = deterministicStatus === 'loadingInspection' || deterministicStatus === 'loadingProvenance' || deterministicStatus === 'validating';

  return (
    <SectionCard>
      <View style={styles.header}>
        <Text style={styles.title}>TOKEN CHECK</Text>
        <Text style={styles.subtitle}>Paste a Solana token mint address to run deterministic TrainRekt analysis.</Text>
      </View>
      <TextInput
        accessibilityLabel="Token mint input"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isBusy}
        onChangeText={onChangeMint}
        placeholder="Paste token mint"
        placeholderTextColor={Colors.mutedText}
        style={styles.input}
        value={mintInput}
      />
      {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
      {!validationError && inlineNotice ? <Text style={styles.notice}>{inlineNotice}</Text> : null}
      {!validationError && !inlineNotice ? <Text style={styles.hint}>Use the mint address of the token you want to understand.</Text> : null}
      <View style={styles.actions}>
        <PrimaryButton onPress={onAnalyze} disabled={isBusy}>{getButtonLabel(deterministicStatus)}</PrimaryButton>
        <PrimaryButton onPress={onClear} disabled={isBusy || mintInput.trim().length === 0} variant="secondary">CLEAR INPUT</PrimaryButton>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  input: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 1,
    color: Colors.text,
    fontSize: Typography.body,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  hint: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
    marginTop: Spacing.xs,
  },
  error: {
    color: Colors.negative,
    fontSize: Typography.small,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  notice: {
    color: Colors.warning,
    fontSize: Typography.small,
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
