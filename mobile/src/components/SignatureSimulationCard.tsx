import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { SimulatedRequestAction, SignatureSimulationExercise } from '@/types/exercise';
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
      <View style={styles.appRow}>
        <View style={styles.appDetails}>
          <Text style={styles.requestingApp}>{exercise.requestingApp}</Text>
          {exercise.requestingDomain && <Text style={styles.requestingDomain}>{exercise.requestingDomain}</Text>}
        </View>
        <Text style={styles.requestType}>{requestTypeLabels[exercise.requestType]}</Text>
      </View>
      <Text style={styles.sectionLabel}>REQUESTED ACTIONS</Text>
      <View style={styles.actions}>
        {exercise.displayedActions.map((action, index) => <RequestActionRow key={`${action.kind}-${index}`} action={action} />)}
      </View>
    </SectionCard>
  );
}

function RequestActionRow({ action }: { action: SimulatedRequestAction }) {
  if (action.kind === 'summary') {
    return <View style={styles.actionRow}><Text style={styles.actionMarker}>•</Text><Text style={styles.action}>{action.label}</Text></View>;
  }

  return (
    <View style={styles.instructionRow}>
      <Text style={styles.actionMarker}>•</Text>
      <View style={styles.instructionCopy}>
        <Text style={styles.action}>{action.instruction}</Text>
        {action.program && <Text style={styles.actionDetail}>Program: {action.program}</Text>}
        {action.details?.map((detail) => <Text key={detail} style={styles.actionDetail}>{detail}</Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#211A48', borderColor: Colors.accent, borderRadius: Radius.sm, borderWidth: 1, marginBottom: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  bannerTitle: { color: Colors.accent, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2 },
  bannerSubtitle: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  appRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.md, justifyContent: 'space-between' },
  appDetails: { flex: 1 },
  requestingApp: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  requestingDomain: { color: Colors.mutedText, fontSize: Typography.small, marginTop: Spacing.xs },
  requestType: { backgroundColor: Colors.secondaryCard, borderRadius: Radius.pill, color: Colors.secondaryText, fontSize: Typography.label, fontWeight: '800', overflow: 'hidden', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  sectionLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2, marginTop: Spacing.md },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  actionRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.sm },
  actionMarker: { color: Colors.accent, fontSize: Typography.body, fontWeight: '900', lineHeight: 22 },
  action: { color: Colors.text, flex: 1, fontSize: Typography.body, lineHeight: 22 },
  instructionRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.sm },
  instructionCopy: { flex: 1 },
  actionDetail: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: 18, marginTop: Spacing.one },
});
