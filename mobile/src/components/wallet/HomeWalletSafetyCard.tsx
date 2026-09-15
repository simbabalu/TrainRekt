import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { categorizeWalletInspectionAccounts } from '@/domain/wallet/categorizeWalletInspectionAccounts';
import { recommendWalletTraining } from '@/domain/wallet/recommendWalletTraining';
import { useWalletSafetyInspection } from '@/hooks/useWalletSafetyInspection';
import { useWallet } from '@/hooks/useWallet';

export function HomeWalletSafetyCard() {
  const router = useRouter();
  const { status: walletStatus, connect } = useWallet();
  const { inspection, address } = useWalletSafetyInspection({ autoFetch: false });

  const connected = walletStatus === 'connected' && Boolean(address);
  const categorySummary = inspection
    ? categorizeWalletInspectionAccounts(inspection.tokenAccounts, inspection.mintInspections).summary
    : null;
  const recommendationCount = inspection
    ? recommendWalletTraining(inspection.tokenAccounts, inspection.mintInspections).length
    : 0;

  if (!connected) {
    return (
      <SectionCard>
        <View style={styles.heading}>
          <AppIcon accessibilityLabel="Wallet safety" name={walletSafetyIcon} badge />
          <Text style={styles.eyebrow}>WALLET SAFETY</Text>
        </View>
        <Text style={styles.description}>Inspect public on-chain wallet signals and learn what deserves attention.</Text>
        <PrimaryButton
          variant="secondary"
          onPress={() => {
            void connect();
          }}
        >
          CONNECT WALLET
        </PrimaryButton>
      </SectionCard>
    );
  }

  if (!categorySummary) {
    return (
      <SectionCard>
        <View style={styles.heading}>
          <AppIcon accessibilityLabel="Wallet safety" name={walletSafetyIcon} badge />
          <Text style={styles.eyebrow}>WALLET SAFETY</Text>
        </View>
        <Text style={styles.connectedLabel}>Wallet connected</Text>
        <PrimaryButton
          variant="secondary"
          onPress={() => {
            router.push('/wallet-safety');
          }}
        >
          CHECK WALLET
        </PrimaryButton>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <View style={styles.heading}>
        <AppIcon accessibilityLabel="Wallet safety" name={walletSafetyIcon} badge />
        <Text style={styles.eyebrow}>WALLET SAFETY</Text>
      </View>
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
      {recommendationCount > 0 ? (
        <Text style={styles.recommendationHint}>{recommendationCount} lesson{recommendationCount === 1 ? '' : 's'} recommended</Text>
      ) : null}
      <PrimaryButton
        variant="secondary"
        onPress={() => {
          router.push('/wallet-safety');
        }}
      >
        REVIEW WALLET
      </PrimaryButton>
    </SectionCard>
  );
}

const walletSafetyIcon = { ios: 'shield.lefthalf.filled', android: 'shield', web: 'shield' } as const;

const styles = StyleSheet.create({
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
    lineHeight: TypographyLineHeight.small,
  },
  connectedLabel: {
    color: Colors.secondaryText,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  metricBlock: {
    gap: Spacing.xs,
  },
  reviewCount: {
    color: Colors.warning,
    fontSize: Typography.heading,
    fontWeight: '900',
    lineHeight: TypographyLineHeight.heading,
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
    lineHeight: TypographyLineHeight.body,
  },
  infoLabel: {
    color: Colors.secondaryText,
    fontSize: Typography.label,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  recommendationHint: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    marginBottom: Spacing.xs,
  },
});
