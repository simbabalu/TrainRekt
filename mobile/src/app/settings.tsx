import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { PageHeading } from '@/components/PageHeading';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

const difficulties = ['Beginner', 'Intermediate', 'Advanced'] as const;

type Difficulty = (typeof difficulties)[number];
type Preferences = { notifications: boolean; sound: boolean; haptics: boolean };

export default function SettingsScreen() {
  const [difficulty, setDifficulty] = useState<Difficulty>('Intermediate');
  const [preferences, setPreferences] = useState<Preferences>({ notifications: true, sound: true, haptics: true });

  function updatePreference(name: keyof Preferences, value: boolean) {
    setPreferences((current) => ({ ...current, [name]: value }));
  }

  return (
    <Screen>
      <PageHeading eyebrow="SETTINGS" title="Make it yours" />
      <SectionCard>
        <Text style={styles.sectionTitle}>Training difficulty</Text>
        <View style={styles.segmented}>{difficulties.map((option) => <Pressable key={option} onPress={() => setDifficulty(option)} style={[styles.segment, difficulty === option && styles.selected]}><Text style={[styles.segmentLabel, difficulty === option && styles.selectedLabel]}>{option}</Text></Pressable>)}</View>
      </SectionCard>
      <SectionCard>
        <SettingRow label="Notifications" value={preferences.notifications} onChange={(value) => updatePreference('notifications', value)} />
        <SettingRow label="Sound effects" value={preferences.sound} onChange={(value) => updatePreference('sound', value)} />
        <SettingRow label="Haptic feedback" value={preferences.haptics} onChange={(value) => updatePreference('haptics', value)} />
      </SectionCard>
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
  sectionTitle: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  segmented: { backgroundColor: Colors.secondaryCard, borderRadius: Radius.md, flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.lg, padding: Spacing.xs },
  segment: { alignItems: 'center', borderRadius: Radius.sm, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: Spacing.xs },
  selected: { backgroundColor: Colors.accent },
  segmentLabel: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  selectedLabel: { color: Colors.text },
  settingRow: { alignItems: 'center', borderBottomColor: Colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58 },
  settingLabel: { color: Colors.text, fontSize: Typography.body, fontWeight: '600' },
  about: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 23, marginTop: Spacing.md },
  version: { borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg, paddingTop: Spacing.lg },
  muted: { color: Colors.secondaryText, fontSize: Typography.body },
  value: { color: Colors.text, fontSize: Typography.body, fontWeight: '700' },
});