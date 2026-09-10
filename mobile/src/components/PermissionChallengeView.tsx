import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { PermissionChallengeDecision, PermissionChallengeExercise } from '@/types/exercise';
import { PrimaryButton } from './PrimaryButton';
import { SectionCard } from './SectionCard';

interface PermissionChallengeViewProps {
  exercise: PermissionChallengeExercise;
  disabled: boolean;
  onSelect: (decision: PermissionChallengeDecision) => void;
}

const permissionTypeLabels: Record<PermissionChallengeExercise['request']['permissionType'], string> = {
  'connect-wallet': 'Connect wallet',
  'sign-message': 'Sign message',
  'sign-transaction': 'Sign transaction',
  'session-authorization': 'Session authorization',
  unknown: 'Unknown request type',
};

export function PermissionChallengeView({ exercise, disabled, onSelect }: PermissionChallengeViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{exercise.title}</Text>
      <Text style={styles.description}>{exercise.description}</Text>

      <SectionCard>
        <SectionHeader title="APPLICATION" iconLabel="Application" iconName={{ ios: 'apps.iphone', android: 'apps', web: 'apps' }} />
        <Text style={styles.primaryValue}>{exercise.request.appName}</Text>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="DOMAIN" iconLabel="Domain" iconName={{ ios: 'globe', android: 'language', web: 'language' }} />
        <Text style={styles.detailLabel}>Displayed domain</Text>
        <Text style={styles.monoValue}>{exercise.request.displayedDomain ?? 'Not shown'}</Text>
        <Text style={styles.detailLabel}>Requested origin</Text>
        <Text style={styles.monoValue}>{exercise.request.requestedOrigin ?? 'Not shown'}</Text>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="REQUEST" iconLabel="Request" iconName={{ ios: 'square.and.pencil', android: 'contract_edit', web: 'contract_edit' }} />
        <Text style={styles.primaryValue}>{permissionTypeLabels[exercise.request.permissionType]}</Text>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="REQUESTED ACCESS" iconLabel="Requested access" iconName={{ ios: 'list.bullet.rectangle', android: 'checklist', web: 'checklist' }} />
        <View style={styles.listBlock}>
          {exercise.request.permissions.map((permission) => (
            <View key={`${permission.label}-${permission.detail}`} style={styles.listRow}>
              <Text style={styles.bullet}>-</Text>
              <View style={styles.listCopy}>
                <Text style={styles.primaryValue}>{permission.label}</Text>
                <Text style={styles.detailValue}>{permission.detail}</Text>
                <Text style={styles.scopeValue}>{permission.required ? 'Required' : 'Optional'} • {permission.scope}</Text>
              </View>
            </View>
          ))}
        </View>
      </SectionCard>

      {exercise.request.contextualFacts && exercise.request.contextualFacts.length > 0 && (
        <SectionCard>
          <SectionHeader title="CONTEXT" iconLabel="Context" iconName={{ ios: 'text.justify.left', android: 'notes', web: 'notes' }} />
          <View style={styles.listBlock}>
            {exercise.request.contextualFacts.map((fact) => (
              <View key={fact} style={styles.listRow}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.detailValue}>{fact}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      )}

      <Text style={styles.question}>What is your decision?</Text>
      <View style={styles.actions}>
        <View style={styles.actionButton}><PrimaryButton variant="secondary" disabled={disabled} onPress={() => onSelect('allow')}>ALLOW</PrimaryButton></View>
        <View style={styles.actionButton}><PrimaryButton variant="secondary" disabled={disabled} onPress={() => onSelect('needs-review')}>NEEDS REVIEW</PrimaryButton></View>
        <View style={styles.actionButton}><PrimaryButton variant="secondary" disabled={disabled} onPress={() => onSelect('reject')}>REJECT</PrimaryButton></View>
      </View>
    </View>
  );
}

function SectionHeader({
  title,
  iconLabel,
  iconName,
}: {
  title: string;
  iconLabel: string;
  iconName: { ios: string; android: string; web: string };
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppIcon accessibilityLabel={iconLabel} name={iconName} size={15} tintColor={Colors.mutedText} />
      <Text style={styles.sectionHeading}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  title: { color: Colors.text, fontSize: Typography.heading, fontWeight: '900' },
  description: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 22 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: Spacing.sm },
  sectionHeading: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  detailLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8, marginTop: Spacing.sm },
  primaryValue: { color: Colors.text, fontSize: Typography.small, fontWeight: '800', lineHeight: 20 },
  monoValue: { color: Colors.secondaryText, fontFamily: 'monospace', fontSize: Typography.small, lineHeight: 20 },
  detailValue: { color: Colors.secondaryText, flex: 1, fontSize: Typography.small, lineHeight: 20 },
  scopeValue: { color: Colors.mutedText, fontSize: Typography.small, marginTop: 1 },
  listBlock: { gap: Spacing.sm },
  listRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.sm },
  listCopy: { flex: 1 },
  bullet: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: 20 },
  question: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800', marginTop: Spacing.xs },
  actions: { gap: Spacing.sm },
  actionButton: { flex: 1 },
});
