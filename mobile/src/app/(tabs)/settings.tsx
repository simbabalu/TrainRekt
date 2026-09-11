import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Radius, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { DEV_DEMO_TOOLS_ENABLED } from '@/constants/debug';
import { getWalletDisplayIdentity } from '@/domain/wallet/getWalletDisplayIdentity';
import { difficultyOptions } from '@/types/settings';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { useWallet } from '@/hooks/useWallet';

export default function SettingsScreen() {
  const { settings, setDifficulty, resetSettings } = useSettings();
  const { resetProgress, prepareDemo } = useTrainingProgress();
  const { status, wallet, error, realMessageSigningEnabled } = useWallet();
  const [showSigningEducation, setShowSigningEducation] = useState(false);
  const isConnected = status === 'connected' && Boolean(wallet);
  const walletStatusLabel = status === 'connecting' ? 'Connecting' : isConnected ? 'Connected' : 'Disconnected';
  const walletDisplayIdentity = wallet ? getWalletDisplayIdentity(wallet) : null;

  function confirmResetProgress() {
    Alert.alert('Reset training progress?', 'This will restore the default training score and history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { void resetProgress(); } },
    ]);
  }

  function confirmResetSettings() {
    Alert.alert('Reset settings?', 'This will restore the default training preferences.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { void resetSettings(); } },
    ]);
  }

  function confirmPrepareDemo() {
    Alert.alert(
      'Prepare demo?',
      'This resets local training progress, achievements, daily progress and demo challenge completion. Your wallet and on-chain data are not changed.',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'PREPARE DEMO', style: 'destructive', onPress: () => { void prepareDemo(); } },
      ],
    );
  }

  return (
    <Screen>
      <PageHeading eyebrow="SETTINGS" title="Make it yours" />
      <SectionCard>
        <View style={styles.walletIdentityCard}>
          <View style={styles.walletRow}>
            <AppIcon accessibilityLabel="Wallet" name={{ ios: 'wallet.pass.fill', android: 'wallet', web: 'wallet' }} badge />

            <View style={styles.walletMainContent}>
              <Text style={styles.walletEyebrow}>WALLET</Text>
              <Text style={styles.walletIdentityPrimary}>{walletDisplayIdentity?.primary ?? 'No wallet connected'}</Text>
              {walletDisplayIdentity?.secondary && <Text style={styles.walletAddress}>{walletDisplayIdentity.secondary}</Text>}
              <View style={styles.walletStatusRow}>
                <View style={[styles.walletStatusDot, isConnected ? styles.walletStatusDotConnected : styles.walletStatusDotDisconnected]} />
                <Text style={[styles.walletStatus, isConnected ? styles.walletStatusConnected : styles.walletStatusDisconnected]}>{walletStatusLabel}</Text>
              </View>
            </View>

          </View>
        </View>

        {error && <Text style={styles.walletError}>{error}</Text>}
      </SectionCard>
      <SectionCard>
        <View style={styles.compactItem}>
          <SectionHeader
            title="REAL WALLET TRAINING"
            subtitle="Real message signing is currently disabled."
            iconName={{ ios: 'signature', android: 'draw', web: 'draw' }}
            iconLabel="Real wallet training"
          />
          <Pressable accessibilityRole="button" onPress={() => setShowSigningEducation((current) => !current)} style={styles.learnMoreButton}>
            <Text style={styles.learnMoreLabel}>{showSigningEducation ? 'HIDE DETAILS' : 'LEARN MORE'}</Text>
          </Pressable>
          {showSigningEducation && (
            <Text style={styles.educationCopy}>
              TrainRekt teaches how to review wallet prompts. This simulator does not request a real signature, transaction, or asset movement.
            </Text>
          )}
          {realMessageSigningEnabled && <Text style={styles.unexpectedStateCopy}>Signing availability is controlled by the wallet safety runtime.</Text>}
        </View>
      </SectionCard>
      <SectionCard>
        <SectionHeader
          title="TRAINING"
          subtitle="Prefer exercises around this challenge level."
          iconName={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }}
          iconLabel="Training difficulty"
        />
        <View style={styles.segmented}>{difficultyOptions.map((option) => <Pressable key={option} onPress={() => setDifficulty(option)} style={[styles.segment, settings.difficulty === option && styles.selected]}><Text style={[styles.segmentLabel, settings.difficulty === option && styles.selectedLabel]}>{option}</Text></Pressable>)}</View>
      </SectionCard>
      <SectionCard>
        <SectionHeader
          title="DATA"
          subtitle="Restore local training data or preferences to their defaults."
          iconName={{ ios: 'arrow.counterclockwise', android: 'restart_alt', web: 'restart_alt' }}
          iconLabel="Reset"
        />
        <View style={styles.resetButtons}>
          <Pressable onPress={confirmResetProgress} style={styles.resetButton}><Text style={styles.resetLabel}>Reset training progress</Text></Pressable>
          <Pressable onPress={confirmResetSettings} style={styles.resetButton}><Text style={styles.resetLabel}>Reset settings</Text></Pressable>
        </View>
      </SectionCard>
      {DEV_DEMO_TOOLS_ENABLED && __DEV__ && (
        <SectionCard>
          <Text style={styles.sectionTitle}>DEMO TOOLS</Text>
          <Text style={styles.devStatusCopy}>Reset local training state for a repeatable hackathon demo.</Text>
          <View style={styles.resetButtons}>
            <Pressable onPress={confirmPrepareDemo} style={styles.resetButton}><Text style={styles.resetLabel}>PREPARE DEMO</Text></Pressable>
          </View>
        </SectionCard>
      )}
      <SectionCard>
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <Text style={styles.about}>TrainRekt is a crypto decision-training simulator.{`\n`}No real assets are traded.</Text>
        <View style={styles.version}><Text style={styles.muted}>Version</Text><Text style={styles.value}>0.1.0</Text></View>
      </SectionCard>
    </Screen>
  );
}

function SectionHeader({
  title,
  subtitle,
  iconName,
  iconLabel,
}: {
  title: string;
  subtitle?: string;
  iconName: AppIconName;
  iconLabel: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppIcon name={iconName} accessibilityLabel={iconLabel} badge />
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2 },
  sectionSubtitle: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.half },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.md },
  sectionHeaderCopy: { flex: 1 },
  segmented: { backgroundColor: Colors.secondaryCard, borderRadius: Radius.md, flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.lg, padding: Spacing.xs },
  segment: { alignItems: 'center', borderRadius: Radius.sm, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: Spacing.xs },
  selected: { backgroundColor: Colors.accent },
  segmentLabel: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  selectedLabel: { color: Colors.text },
  walletIdentityCard: { backgroundColor: Colors.secondaryCard, borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md },
  walletRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.md },
  walletMainContent: { flex: 1, gap: Spacing.half },
  walletEyebrow: { color: Colors.secondaryText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.1 },
  walletIdentityPrimary: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' },
  walletAddress: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: 1 },
  walletStatusRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  walletStatusDot: { borderRadius: Radius.pill, height: 8, width: 8 },
  walletStatusDotConnected: { backgroundColor: Colors.positive },
  walletStatusDotDisconnected: { backgroundColor: Colors.mutedText },
  walletStatus: { fontSize: Typography.small, fontWeight: '700' },
  walletStatusConnected: { color: Colors.positive },
  walletStatusDisconnected: { color: Colors.secondaryText },
  walletError: { color: Colors.negative, fontSize: Typography.small, fontWeight: '600', marginTop: Spacing.md },
  compactItem: { gap: Spacing.sm },
  learnMoreButton: { alignSelf: 'flex-start', paddingVertical: Spacing.xs },
  learnMoreLabel: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  educationCopy: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  unexpectedStateCopy: { color: Colors.warning, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  about: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: TypographyLineHeight.body, marginTop: Spacing.md },
  resetButtons: { gap: Spacing.sm, marginTop: Spacing.lg },
  resetButton: { alignItems: 'center', borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.md },
  resetLabel: { color: Colors.negative, fontSize: Typography.small, fontWeight: '800' },
  version: { borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg, paddingTop: Spacing.lg },
  muted: { color: Colors.secondaryText, fontSize: Typography.body },
  value: { color: Colors.text, fontSize: Typography.body, fontWeight: '700' },
  devStatusCopy: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
});