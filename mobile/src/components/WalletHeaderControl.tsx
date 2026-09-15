import * as React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { abbreviateWalletAddress } from '@/domain/wallet/abbreviateWalletAddress';
import { getWalletDisplayIdentity } from '@/domain/wallet/getWalletDisplayIdentity';
import { useWallet } from '@/hooks/useWallet';

export function WalletHeaderControl() {
  const { status, wallet, connect, disconnect } = useWallet();
  const [menuVisible, setMenuVisible] = React.useState(false);
  const isConnected = status === 'connected' && Boolean(wallet);
  const identity = wallet ? getWalletDisplayIdentity(wallet) : null;

  async function handleConnect() {
    await connect();
  }

  async function handleDisconnect() {
    setMenuVisible(false);
    await disconnect();
  }

  if (status === 'connecting') {
    return (
      <View
        accessibilityRole="button"
        accessibilityLabel="Wallet connecting"
        accessibilityState={{ disabled: true, busy: true }}
        style={[styles.control, styles.controlDisabled]}
      >
        <Text style={styles.controlText}>CONNECTING...</Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Connect wallet"
        accessibilityState={{ disabled: false }}
        style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
        onPress={() => {
          void handleConnect();
        }}
      >
        <Text style={styles.controlText}>CONNECT</Text>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Wallet connected: ${identity?.primary ?? 'Connected wallet'}`}
        accessibilityState={{ expanded: menuVisible }}
        style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
        onPress={() => setMenuVisible(true)}
      >
        <View style={styles.connectedRow}>
          <Text style={styles.controlText}>{identity?.primary ?? 'CONNECTED'}</Text>
          <Text style={styles.chevronText}>{'>'}</Text>
        </View>
      </Pressable>

      <Modal visible={menuVisible} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <Pressable accessibilityRole="menu" accessibilityLabel="Connected wallet menu" style={styles.menuCard} onPress={() => undefined}>
            <Text style={styles.menuTitle}>CONNECTED WALLET</Text>
            <Text style={styles.menuPrimary}>{identity?.primary ?? 'Connected wallet'}</Text>
            {wallet?.address ? <Text style={styles.menuSecondary}>{abbreviateWalletAddress(wallet.address)}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Disconnect wallet"
              style={({ pressed }) => [styles.disconnectButton, pressed && styles.controlPressed]}
              onPress={() => {
                void handleDisconnect();
              }}
            >
              <Text style={styles.disconnectLabel}>DISCONNECT</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: 'center',
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 126,
    paddingHorizontal: Spacing.md,
  },
  controlDisabled: {
    opacity: 0.72,
  },
  controlPressed: {
    opacity: 0.84,
  },
  controlText: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  connectedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  chevronText: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    fontWeight: '900',
    lineHeight: Typography.small,
  },
  menuBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(9, 11, 16, 0.78)',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  menuCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    width: '100%',
  },
  menuTitle: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  menuPrimary: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  menuSecondary: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    marginTop: Spacing.xs,
  },
  disconnectButton: {
    alignItems: 'center',
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: Spacing.lg,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
  },
  disconnectLabel: {
    color: Colors.negative,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
