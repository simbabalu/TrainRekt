import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { getWalletDisplayIdentity } from '@/domain/wallet/getWalletDisplayIdentity';
import { difficultyOptions } from '@/types/settings';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { useWallet } from '@/hooks/useWallet';

export default function SettingsScreen() {
  const { settings, setDifficulty, setPreference, resetSettings } = useSettings();
  const { resetProgress, debugSimulatePreviousDay } = useTrainingProgress();
  const { status, wallet, error, connect, disconnect } = useWallet();
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

            <View style={styles.walletActionColumn}>
              {isConnected ? (
                <Pressable onPress={() => { void disconnect(); }} style={styles.walletButton}>
                  <Text style={styles.walletButtonLabel}>Disconnect</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => { void connect(); }} disabled={status === 'connecting'} style={[styles.walletButton, status === 'connecting' && styles.walletButtonDisabled]}>
                  <Text style={styles.walletButtonLabel}>{status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {error && <Text style={styles.walletError}>{error}</Text>}
      </SectionCard>
      <SectionCard>
        <SectionHeader
          title="Training difficulty"
          subtitle="Adjust the challenge level"
          iconName={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }}
          iconLabel="Training difficulty"
        />
        <View style={styles.segmented}>{difficultyOptions.map((option) => <Pressable key={option} onPress={() => setDifficulty(option)} style={[styles.segment, settings.difficulty === option && styles.selected]}><Text style={[styles.segmentLabel, settings.difficulty === option && styles.selectedLabel]}>{option}</Text></Pressable>)}</View>
      </SectionCard>
      <SectionCard>
        <PreferenceRow
          iconName={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
          iconLabel="Notifications"
          label="Notifications"
          description="Get reminders and updates"
          value={settings.notificationsEnabled}
          onChange={(value) => setPreference('notificationsEnabled', value)}
        />
        <PreferenceRow
          iconName={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }}
          iconLabel="Sound effects"
          label="Sound effects"
          description="Play feedback sounds"
          value={settings.soundEffectsEnabled}
          onChange={(value) => setPreference('soundEffectsEnabled', value)}
        />
        <PreferenceRow
          iconName={{ ios: 'iphone.radiowaves.left.and.right', android: 'vibration', web: 'vibration' }}
          iconLabel="Haptic feedback"
          label="Haptic feedback"
          description="Feel interactions"
          value={settings.hapticFeedbackEnabled}
          onChange={(value) => setPreference('hapticFeedbackEnabled', value)}
          isLast
        />
      </SectionCard>
      <SectionCard>
        <SectionHeader
          title="Reset"
          subtitle="Restore local training data or preferences to their defaults."
          iconName={{ ios: 'arrow.counterclockwise', android: 'restart_alt', web: 'restart_alt' }}
          iconLabel="Reset"
        />
        <View style={styles.resetButtons}>
          <Pressable onPress={confirmResetProgress} style={styles.resetButton}><Text style={styles.resetLabel}>Reset training progress</Text></Pressable>
          <Pressable onPress={confirmResetSettings} style={styles.resetButton}><Text style={styles.resetLabel}>Reset settings</Text></Pressable>
        </View>
      </SectionCard>
      {__DEV__ && (
        <SectionCard>
          <Text style={styles.sectionTitle}>DEVELOPER TOOLS</Text>
          <Text style={styles.about}>Simulate the daily training rollover without changing the device clock.</Text>
          <View style={styles.resetButtons}>
            <Pressable onPress={debugSimulatePreviousDay} style={styles.resetButton}><Text style={styles.resetLabel}>Simulate previous day</Text></Pressable>
          </View>
        </SectionCard>
      )}
      <SectionCard>
        <Text style={styles.sectionTitle}>About TrainRekt</Text>
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

function PreferenceRow({
  iconName,
  iconLabel,
  label,
  description,
  value,
  onChange,
  isLast = false,
}: {
  iconName: AppIconName;
  iconLabel: string;
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.preferenceRow, !isLast && styles.preferenceRowDivider]}>
      <View style={styles.preferenceLeft}>
        <AppIcon name={iconName} accessibilityLabel={iconLabel} badge />
        <View style={styles.preferenceCopy}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: Colors.secondaryCard, true: Colors.accent }} thumbColor={Colors.text} />
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
  walletActionColumn: { alignSelf: 'stretch', justifyContent: 'flex-end' },
  walletError: { color: Colors.negative, fontSize: Typography.small, fontWeight: '600', marginTop: Spacing.md },
  walletButton: { alignItems: 'center', backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, minHeight: 44, justifyContent: 'center', minWidth: 122, paddingHorizontal: Spacing.md },
  walletButtonDisabled: { opacity: 0.65 },
  walletButtonLabel: { color: Colors.text, fontSize: Typography.small, fontWeight: '700' },
  preferenceRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingVertical: Spacing.xs },
  preferenceRowDivider: { borderBottomColor: Colors.border, borderBottomWidth: 1 },
  preferenceLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.md, marginRight: Spacing.md },
  preferenceCopy: { flex: 1 },
  settingLabel: { color: Colors.text, fontSize: Typography.body, fontWeight: '600' },
  settingDescription: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.half },
  about: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 23, marginTop: Spacing.md },
  resetButtons: { gap: Spacing.sm, marginTop: Spacing.lg },
  resetButton: { alignItems: 'center', borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.md },
  resetLabel: { color: Colors.negative, fontSize: Typography.small, fontWeight: '800' },
  version: { borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg, paddingTop: Spacing.lg },
  muted: { color: Colors.secondaryText, fontSize: Typography.body },
  value: { color: Colors.text, fontSize: Typography.body, fontWeight: '700' },
});