import { StyleSheet, Text } from 'react-native';

import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { WalletSafetySnapshotCard } from '@/components/WalletSafetySnapshotCard';
import { Colors, Typography } from '@/constants/theme';
import { useWalletSnapshot } from '@/hooks/useWalletSnapshot';
import { useWallet } from '@/hooks/useWallet';

export default function WalletSafetyScreen() {
  const { wallet, connect } = useWallet();
  const { isConnected, status, snapshot, error, network, refresh } = useWalletSnapshot();

  return (
    <Screen>
      <PageHeading
        eyebrow="WALLET SAFETY"
        title="Read-only wallet snapshot"
        subtitle="Inspect your connected wallet with public RPC reads only."
      />
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
          void refresh();
        }}
      />
      <Text style={styles.footer}>This snapshot is informational and does not classify assets as safe or unsafe.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: 20,
  },
});
