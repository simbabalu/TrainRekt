import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { SignatureSimulationExercise } from '@/types/exercise';
import { SectionCard } from './SectionCard';

const requestTypeLabels: Record<SignatureSimulationExercise['requestType'], string> = {
  message: 'Message signature',
  transaction: 'Transaction signature',
  authorization: 'Authorization request',
};

export function SignatureSimulationCard({ exercise }: { exercise: SignatureSimulationExercise }) {
  return (
    <SectionCard>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>SIMULATION</Text>
        <Text style={styles.bannerSubtitle}>No real transaction will be signed</Text>
      </View>
      <Text style={styles.requestingApp}>{exercise.requestingApp}</Text>
      {exercise.requestingDomain && <Text style={styles.requestingDomain}>{exercise.requestingDomain}</Text>}
      <Text style={styles.sectionLabel}>REQUEST</Text>
      <Text style={styles.requestType}>{requestTypeLabels[exercise.requestType]}</Text>
      <Text style={styles.sectionLabel}>REQUESTED ACTIONS</Text>
      <View style={styles.actions}>
        {exercise.displayedActions.map((action) => <Text key={action} style={styles.action}>• {action}</Text>)}
      </View>
      {exercise.safeIndicators && exercise.safeIndicators.length > 0 && (
        <View style={styles.safeIndicators}>
          {exercise.safeIndicators.map((indicator) => <Text key={indicator} style={styles.safeIndicator}>✓ {indicator}</Text>)}
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#211A48', borderColor: Colors.accent, borderRadius: Radius.sm, borderWidth: 1, marginBottom: Spacing.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  bannerTitle: { color: Colors.accent, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2 },
  bannerSubtitle: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  requestingApp: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  requestingDomain: { color: Colors.mutedText, fontSize: Typography.small, marginTop: Spacing.xs },
  sectionLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2, marginTop: Spacing.lg },
  requestType: { color: Colors.text, fontSize: Typography.body, fontWeight: '700', marginTop: Spacing.xs },
  actions: { gap: Spacing.xs, marginTop: Spacing.xs },
  action: { color: Colors.text, fontSize: Typography.body, lineHeight: 22 },
  safeIndicators: { gap: Spacing.xs, marginTop: Spacing.lg },
  safeIndicator: { color: Colors.positive, fontSize: Typography.small, fontWeight: '700' },
});
