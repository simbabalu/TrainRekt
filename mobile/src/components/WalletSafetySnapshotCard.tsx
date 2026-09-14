import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { AppIcon } from '@/components/AppIcon';
import { Colors, Radius, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { formatLamportsToSol } from '@/domain/wallet/formatLamportsToSol';
import { formatWalletSnapshotTime } from '@/domain/wallet/formatWalletSnapshotTime';
import { getWalletDisplayIdentity } from '@/domain/wallet/getWalletDisplayIdentity';
import type { WalletSnapshot } from '@/types/walletSnapshot';
import type { ConnectedWallet } from '@/types/wallet';

interface WalletSafetySnapshotCardProps {
  wallet: ConnectedWallet | null;
  connected: boolean;
  network: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  snapshot: WalletSnapshot | null;
  error: string | null;
  onConnect: () => void;
  onRefresh: () => void;
}

export function WalletSafetySnapshotCard({
  wallet,
  connected,
  network,
  status,
  snapshot,
  error,
  onConnect,
  onRefresh,
}: WalletSafetySnapshotCardProps) {
  const identity = wallet ? getWalletDisplayIdentity(wallet) : null;
  const showingSnapshot = Boolean(snapshot);
  const loading = status === 'loading';
  const displayedNetwork = snapshot?.network ?? network;
  const displayedSolBalance = snapshot ? `${formatLamportsToSol(snapshot.solBalanceLamports)} SOL` : '--';
  const displayedTokenCount = snapshot ? String(snapshot.tokenAccountCount) : '--';
  const displayedNonZeroTokenCount = snapshot ? String(snapshot.nonZeroTokenAccountCount) : '--';
  const displayedZeroTokenCount = snapshot ? String(snapshot.zeroBalanceTokenAccountCount) : '--';
  const displayedLastChecked = snapshot ? formatWalletSnapshotTime(snapshot.fetchedAt) : loading ? 'Checking...' : 'Not checked';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppIcon accessibilityLabel="Wallet safety" name={{ ios: 'shield.lefthalf.filled', android: 'shield', web: 'shield' }} badge />
        <View style={styles.headerCopy}>
          <Text style={styles.title}>WALLET SAFETY</Text>
          <Text style={styles.subtitle}>READ ONLY</Text>
          <Text style={styles.subtle}>No signature required</Text>
        </View>
      </View>

      {!connected && (
        <View style={styles.disconnectedState}>
          <Text style={styles.copy}>Connect a wallet to run a read-only safety check.</Text>
          <PrimaryButton onPress={onConnect}>CONNECT WALLET</PrimaryButton>
        </View>
      )}

      {connected && (
        <View style={styles.connectedState}>
          <View style={styles.identityBox}>
            <Text style={styles.identityPrimary}>{identity?.primary ?? 'Connected wallet'}</Text>
            <Text style={styles.identitySecondary}>{wallet?.address ?? identity?.secondary ?? ''}</Text>
          </View>

          <View style={styles.statsRow}>
            <Metric label="NETWORK" value={displayedNetwork} />
            <Metric label="SOL BALANCE" value={displayedSolBalance} />
          </View>

          <View style={styles.statsRow}>
            <Metric label="TOKEN ACCOUNTS" value={displayedTokenCount} />
            <Metric label="WITH BALANCE" value={displayedNonZeroTokenCount} />
          </View>

          <View style={styles.statsRow}>
            <Metric label="EMPTY" value={displayedZeroTokenCount} />
            <Metric label="LAST CHECKED" value={displayedLastChecked} />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {!showingSnapshot && !loading && !error && (
            <Text style={styles.copy}>Tap refresh to load the latest read-only snapshot.</Text>
          )}

          <PrimaryButton onPress={onRefresh} disabled={loading}>
            {loading ? 'REFRESHING...' : error ? 'RETRY' : 'REFRESH'}
          </PrimaryButton>
        </View>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.lg,
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  subtitle: {
    color: Colors.accent,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  subtle: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
  },
  disconnectedState: {
    gap: Spacing.md,
  },
  connectedState: {
    gap: Spacing.md,
  },
  identityBox: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  identityPrimary: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
  },
  identitySecondary: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metric: {
    flex: 1,
    gap: Spacing.xs,
  },
  metricLabel: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
  },
  copy: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  errorText: {
    color: Colors.negative,
    fontSize: Typography.small,
    fontWeight: '700',
  },
});
