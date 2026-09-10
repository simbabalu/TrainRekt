import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { difficultyOptions } from '@/types/settings';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';

export default function SettingsScreen() {
  const { settings, setDifficulty, setPreference, resetSettings } = useSettings();
  const { resetProgress, debugSimulatePreviousDay } = useTrainingProgress();

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
        <Text style={styles.sectionTitle}>Training difficulty</Text>
        <View style={styles.segmented}>{difficultyOptions.map((option) => <Pressable key={option} onPress={() => setDifficulty(option)} style={[styles.segment, settings.difficulty === option && styles.selected]}><Text style={[styles.segmentLabel, settings.difficulty === option && styles.selectedLabel]}>{option}</Text></Pressable>)}</View>
      </SectionCard>
      <SectionCard>
        <SettingRow label="Notifications" value={settings.notificationsEnabled} onChange={(value) => setPreference('notificationsEnabled', value)} />
        <SettingRow label="Sound effects" value={settings.soundEffectsEnabled} onChange={(value) => setPreference('soundEffectsEnabled', value)} />
        <SettingRow label="Haptic feedback" value={settings.hapticFeedbackEnabled} onChange={(value) => setPreference('hapticFeedbackEnabled', value)} />
      </SectionCard>
      <SectionCard>
        <Text style={styles.sectionTitle}>RESET</Text>
        <Text style={styles.about}>Restore local training data or preferences to their defaults.</Text>
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

function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.settingRow}><Text style={styles.settingLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: Colors.secondaryCard, true: Colors.accent }} thumbColor={Colors.text} /></View>;
}

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2 },
  segmented: { backgroundColor: Colors.secondaryCard, borderRadius: Radius.md, flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.lg, padding: Spacing.xs },
  segment: { alignItems: 'center', borderRadius: Radius.sm, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: Spacing.xs },
  selected: { backgroundColor: Colors.accent },
  segmentLabel: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  selectedLabel: { color: Colors.text },
  settingRow: { alignItems: 'center', borderBottomColor: Colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58 },
  settingLabel: { color: Colors.text, fontSize: Typography.body, fontWeight: '600' },
  about: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 23, marginTop: Spacing.md },
  resetButtons: { gap: Spacing.sm, marginTop: Spacing.lg },
  resetButton: { alignItems: 'center', borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.md },
  resetLabel: { color: Colors.negative, fontSize: Typography.small, fontWeight: '800' },
  version: { borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg, paddingTop: Spacing.lg },
  muted: { color: Colors.secondaryText, fontSize: Typography.body },
  value: { color: Colors.text, fontSize: Typography.body, fontWeight: '700' },
});