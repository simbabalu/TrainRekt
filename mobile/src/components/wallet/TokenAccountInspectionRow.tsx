import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { abbreviateWalletAddress } from '@/domain/wallet/abbreviateWalletAddress';
import { deriveWalletSafetySignals } from '@/domain/wallet/deriveWalletSafetySignals';
import type { WalletTokenAccountInspection } from '@/types/walletInspection';
import { WalletSafetySignalBadge } from './WalletSafetySignalBadge';

interface TokenAccountInspectionRowProps {
  account: WalletTokenAccountInspection;
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={[styles.detailValue, mono ? styles.detailValueMono : null]}>{value}</Text>
    </View>
  );
}

function titleFromProgram(program: WalletTokenAccountInspection['program']): string {
  if (program === 'spl-token') return 'SPL Token';
  if (program === 'token-2022') return 'Token-2022';
  return 'Unknown';
}

function titleFromState(state: WalletTokenAccountInspection['state']): string {
  if (state === 'initialized') return 'Initialized';
  if (state === 'frozen') return 'Frozen';
  return 'Unknown';
}

function normalizeDisplayValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function TokenAccountInspectionRow({ account }: TokenAccountInspectionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const signals = useMemo(
    () => deriveWalletSafetySignals([account]),
    [account],
  );

  const primaryCategory = useMemo(() => {
    if (signals.some((signal) => signal.category === 'review')) return 'review';
    if (signals.some((signal) => signal.category === 'informational')) return 'informational';
    return 'normal';
  }, [signals]);

  const tokenName = normalizeDisplayValue(account.tokenDisplayMetadata?.name);
  const tokenSymbol = normalizeDisplayValue(account.tokenDisplayMetadata?.symbol);
  const title = tokenName ?? tokenSymbol ?? 'Unknown Token';
  const subtitle = tokenName && tokenSymbol
    ? tokenSymbol
    : tokenName
      ? null
      : tokenSymbol
        ? null
        : `Mint: ${abbreviateWalletAddress(account.mintAddress)}`;

  return (
    <Pressable
      onPress={() => setExpanded((current) => !current)}
      style={[styles.row, primaryCategory === 'review' ? styles.rowReview : null]}
    >
      <View style={styles.rowHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.tokenTitle}>{title}</Text>
          {subtitle && <Text style={styles.tokenSubtitle}>{subtitle}</Text>}
        </View>
        <Text style={styles.expandLabel}>{expanded ? 'HIDE' : 'DETAILS'}</Text>
      </View>

      {signals.length > 0 && (
        <View style={styles.badgeRow}>
          {signals.map((signal) => (
            <WalletSafetySignalBadge key={`${account.tokenAccountAddress}:${signal.kind}`} signal={signal} />
          ))}
        </View>
      )}

      {expanded && (
        <View style={styles.details}>
          <DetailRow label="TOKEN ACCOUNT" value={account.tokenAccountAddress} mono />
          <DetailRow label="MINT" value={account.mintAddress} mono />
          <Text style={styles.detailHint}>Name/symbol are untrusted display metadata. Mint is the canonical identifier.</Text>
          <DetailRow label="PROGRAM" value={titleFromProgram(account.program)} />
          <DetailRow label="STATE" value={titleFromState(account.state)} />
          <DetailRow label="RAW AMOUNT" value={account.rawAmount} />
          <DetailRow label="DECIMALS" value={String(account.decimals)} />
          <DetailRow label="UI AMOUNT" value={account.uiAmount == null ? 'Unknown' : String(account.uiAmount)} />
          <DetailRow label="DELEGATE" value={account.delegateAddress ?? 'None'} mono />
          <DetailRow label="DELEGATED AMOUNT" value={account.delegatedAmountRaw ?? 'None'} />
          <DetailRow label="CLOSE AUTHORITY" value={account.closeAuthorityAddress ?? 'None'} mono />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  rowReview: {
    borderColor: Colors.warning,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  tokenTitle: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
  },
  tokenSubtitle: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
  },
  expandLabel: {
    color: Colors.accent,
    fontSize: Typography.small,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  details: {
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  detailRow: {
    gap: Spacing.xs,
  },
  detailLabel: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  detailValue: {
    color: Colors.text,
    fontSize: Typography.small,
    flexShrink: 1,
    lineHeight: 18,
  },
  detailValueMono: {
    fontFamily: Fonts.mono,
  },
  detailHint: {
    color: Colors.mutedText,
    fontSize: Typography.small,
    lineHeight: 18,
  },
});
