import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { categorizeWalletInspectionAccounts } from '@/domain/wallet/categorizeWalletInspectionAccounts';
import { useWalletSafetyInspection } from '@/hooks/useWalletSafetyInspection';
import { useWallet } from '@/hooks/useWallet';

export function HomeWalletSafetyCard() {
  const router = useRouter();
  const { status: walletStatus, connect } = useWallet();
  const { inspection, address } = useWalletSafetyInspection({ autoFetch: false });

  const connected = walletStatus === 'connected' && Boolean(address);
  const categorySummary = inspection ? categorizeWalletInspectionAccounts(inspection.tokenAccounts).summary : null;

  if (!connected) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>WALLET SAFETY</Text>
        <Text style={styles.description}>Inspect public on-chain wallet signals and learn what deserves attention.</Text>
        <PrimaryButton
          variant="secondary"
          onPress={() => {
            void connect();
          }}
        >
          CONNECT WALLET
        </PrimaryButton>
      </View>
    );
  }

  if (!categorySummary) {
    return (
      <Pressable
        onPress={() => {
          router.push('/wallet-safety');
        }}
        style={[styles.card, styles.compactCard]}
      >
        <Text style={styles.eyebrow}>WALLET SAFETY</Text>
        <Text style={styles.connectedLabel}>Wallet connected</Text>
        <Text style={styles.linkLabel}>CHECK WALLET {'>'}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => {
        router.push('/wallet-safety');
      }}
      style={[styles.card, styles.compactCard]}
    >
      <Text style={styles.eyebrow}>WALLET SAFETY</Text>
      <View style={styles.metricRow}>
        <View style={styles.metricBlock}>
          <Text style={styles.reviewCount}>{categorySummary.reviewAccountCount}</Text>
          <Text style={styles.reviewLabel}>NEED REVIEW</Text>
        </View>
        <View style={styles.metricBlock}>
          <Text style={styles.infoCount}>{categorySummary.informationalAccountCount}</Text>
          <Text style={styles.infoLabel}>INFORMATIONAL</Text>
        </View>
      </View>
      <Text style={styles.linkLabel}>Review your connected wallet {'>'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  compactCard: {
    paddingVertical: Spacing.md,
  },
  eyebrow: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 1,
  },
  description: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: 18,
  },
  connectedLabel: {
    color: Colors.secondaryText,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  metricBlock: {
    gap: Spacing.half,
  },
  reviewCount: {
    color: Colors.warning,
    fontSize: Typography.heading,
    fontWeight: '900',
    lineHeight: 24,
  },
  reviewLabel: {
    color: Colors.warning,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  infoCount: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '900',
    lineHeight: 24,
  },
  infoLabel: {
    color: Colors.secondaryText,
    fontSize: Typography.label,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  linkLabel: {
    color: Colors.accent,
    fontSize: Typography.small,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
