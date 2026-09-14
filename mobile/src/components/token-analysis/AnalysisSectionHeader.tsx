import { StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { Colors, Spacing, Typography } from '@/constants/theme';

export type AnalysisSectionIcon =
  | 'identity'
  | 'classification'
  | 'review'
  | 'authorities'
  | 'concentration'
  | 'evidence'
  | 'chronology'
  | 'limitations'
  | 'provenance'
  | 'coach';

const iconNames: Record<AnalysisSectionIcon, AppIconName> = {
  authorities: { ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' },
  chronology: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  classification: { ios: 'magnifyingglass.circle.fill', android: 'manage_search', web: 'manage_search' },
  coach: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  concentration: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  evidence: { ios: 'doc.text.magnifyingglass', android: 'fact_check', web: 'fact_check' },
  identity: { ios: 'person.crop.circle.fill', android: 'badge', web: 'badge' },
  limitations: { ios: 'info.circle.fill', android: 'info', web: 'info' },
  provenance: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  review: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
};

interface AnalysisSectionHeaderProps {
  title: string;
  icon: AnalysisSectionIcon;
}

export function AnalysisSectionHeader({ title, icon }: AnalysisSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppIcon accessibilityLabel={`${title} section`} name={iconNames[icon]} size={18} tintColor={Colors.accent} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  title: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.7 },
});
