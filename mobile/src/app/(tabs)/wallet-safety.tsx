import { StyleSheet, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { PageHeading } from '@/components/PageHeading';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { WalletSafetySnapshotCard } from '@/components/WalletSafetySnapshotCard';
import { WalletSafetyInspection } from '@/components/wallet/WalletSafetyInspection';
import { Colors, Typography, TypographyLineHeight } from '@/constants/theme';
import { useWalletSnapshot } from '@/hooks/useWalletSnapshot';
import { useWalletSafetyInspection } from '@/hooks/useWalletSafetyInspection';
import { useWallet } from '@/hooks/useWallet';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

export default function WalletSafetyScreen() {
  const router = useRouter();
  const { wallet, connect } = useWallet();
  const { progress } = useTrainingProgress();
  const { isConnected, status, snapshot, error, network, refresh } = useWalletSnapshot();
  const {
    status: inspectionStatus,
    viewMode: inspectionViewMode,
    inspection,
    error: inspectionError,
    setViewMode: setInspectionViewMode,
    refresh: refreshInspection,
  } = useWalletSafetyInspection();
  const refreshWalletData = () => {
    void Promise.all([refresh(), refreshInspection()]);
  };

  return (
    <Screen>
      <PageHeading
        eyebrow="WALLET SAFETY"
        title="Read-only wallet snapshot"
        subtitle="Inspect your connected wallet with public RPC reads only."
      />
      <PrimaryButton variant="secondary" onPress={() => { router.push('/(tabs)/token-analysis' as Href); }}>ANALYZE TOKEN</PrimaryButton>
      <WalletSafetySnapshotCard
        wallet={wallet}
        connected={isConnected}
        network={network}
        status={status}
        snapshot={snapshot}
        error={error}
        onConnect={() => {
          void connect();
        }}
        onRefresh={() => {
          refreshWalletData();
        }}
      />
      <WalletSafetyInspection
        connected={isConnected}
        status={inspectionStatus}
        viewMode={inspectionViewMode}
        inspection={inspection}
        error={inspectionError}
        onViewModeChange={setInspectionViewMode}
        onRefresh={() => {
          refreshWalletData();
        }}
        walletLessonProgress={progress.walletLessonProgress}
      />
      <Text style={styles.footer}>This snapshot is informational and does not classify assets as safe or unsafe.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
});