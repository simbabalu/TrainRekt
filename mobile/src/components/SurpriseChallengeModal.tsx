import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { SurpriseChallengeEvaluation } from '@/domain/surprise/evaluateSurpriseChallengeCompletion';
import { SurpriseChallengeSession } from '@/hooks/useSurpriseChallengeEngine';
import { SurpriseChallengeDecision } from '@/types/surpriseChallenge';

interface SurpriseChallengeModalProps {
  session: SurpriseChallengeSession | null;
  onChooseDecision: (decision: SurpriseChallengeDecision) => void;
  onCloseReveal: () => void;
}

export function SurpriseChallengeModal({ session, onChooseDecision, onCloseReveal }: SurpriseChallengeModalProps) {
  const insets = useSafeAreaInsets();
  if (!session) return null;
  const isReveal = session.stage === 'reveal';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[styles.contentContainer, isReveal && styles.revealContentContainer]}
            showsVerticalScrollIndicator={false}
          >
            {session.isPreview ? <Text style={styles.previewLabel}>DEV PREVIEW</Text> : null}
            {isReveal ? (
              <RevealView session={session} />
            ) : (
              <PromptView session={session} onChooseDecision={onChooseDecision} />
            )}
          </ScrollView>
          {isReveal ? (
            <View style={[styles.ctaFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
              <ActionButton label="CONTINUE" onPress={onCloseReveal} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function PromptView({ session, onChooseDecision }: { session: SurpriseChallengeSession; onChooseDecision: (decision: SurpriseChallengeDecision) => void }) {
  const { challenge } = session;
  return (
    <>
      <Text style={styles.eyebrow}>{challenge.presentation.title}</Text>
      {challenge.presentation.rewardLabel ? <Text style={styles.rewardLabel}>{challenge.presentation.rewardLabel}</Text> : null}
      <Text style={styles.message}>{challenge.presentation.message}</Text>
      {challenge.presentation.sourceLabel ? <Text style={styles.meta}>Source: {challenge.presentation.sourceLabel}</Text> : null}
      {challenge.presentation.domain ? <Text style={styles.meta}>Domain: {challenge.presentation.domain}</Text> : null}
      <Text style={styles.countdownLabel}>Eligibility expires in</Text>
      <Text style={styles.countdownValue}>{formatCountdown(session.countdownSecondsRemaining)}</Text>
      {session.stage === 'inspect' ? (
        <InspectionDetails
          sourceLabel={challenge.presentation.sourceLabel}
          domain={challenge.presentation.domain}
          rewardLabel={challenge.presentation.rewardLabel}
        />
      ) : null}
      <View style={styles.actions}>
        {session.stage === 'prompt' ? (
          <>
            <ActionButton label="SIGN" onPress={() => onChooseDecision('sign')} />
            <ActionButton label="INSPECT" onPress={() => onChooseDecision('inspect')} />
            <ActionButton label="REJECT" onPress={() => onChooseDecision('reject')} />
          </>
        ) : (
          <>
            <ActionButton label="SIGN" onPress={() => onChooseDecision('sign')} />
            <ActionButton label="REJECT" onPress={() => onChooseDecision('reject')} />
          </>
        )}
      </View>
    </>
  );
}

function RevealView({ session }: { session: SurpriseChallengeSession }) {
  const { challenge } = session;
  const evaluation = session.evaluation;

  if (!evaluation) return null;

  return (
    <>
      <ResultHeader evaluation={evaluation} badge={session.badgeEarned ? challenge.badge : undefined} />
      {session.isPreview ? <Text style={styles.previewCopy}>Preview mode does not award XP, badges, or completion progress.</Text> : null}

      <View style={styles.secondarySection}>
        <Text style={styles.sectionLabel}>YOUR DECISIONS</Text>
        <View style={styles.decisionRow}>
          <Text style={styles.decisionLabel}>FIRST</Text>
          <Text style={styles.decisionValue}>{session.firstDecision?.toUpperCase() ?? 'UNKNOWN'}</Text>
        </View>
        <View style={styles.decisionRow}>
          <Text style={styles.decisionLabel}>FINAL</Text>
          <Text style={styles.decisionValue}>{session.finalDecision?.toUpperCase() ?? 'UNKNOWN'}</Text>
        </View>
      </View>

      <LearningSummary challenge={challenge} />
    </>
  );
}

function ResultHeader({ evaluation, badge }: { evaluation: SurpriseChallengeEvaluation; badge?: { name: string; description: string } }) {
  const isRisky = evaluation.rating === 'risky';
  return (
    <View style={[styles.resultCard, isRisky ? styles.resultCardRisky : styles.resultCardSafe]}>
      <Text style={[styles.resultIcon, isRisky ? styles.resultRiskyText : styles.resultSafeText]}>{isRisky ? '!' : 'OK'}</Text>
      <Text style={styles.simulationLabel}>SECURITY SIMULATION</Text>
      <Text style={styles.resultHeadline}>{evaluation.headline}</Text>
      <Text style={styles.resultSummary}>{evaluation.summary}</Text>
      <Text style={styles.rewardCaption}>REWARD</Text>
      <Text style={styles.xpValue}>{`+${evaluation.xpAwarded} XP`}</Text>
      {badge ? (
        <View style={styles.badgeCard}>
          <Text style={styles.badgeTitle}>BADGE EARNED</Text>
          <Text style={styles.badgeName}>{badge.name}</Text>
          <Text style={styles.badgeDescription}>{badge.description}</Text>
        </View>
      ) : (
        <Text style={styles.noBadge}>No badge earned this time</Text>
      )}
    </View>
  );
}

function LearningSummary({ challenge }: { challenge: SurpriseChallengeSession['challenge'] }) {
  const watchItems = Array.from(new Set([...challenge.manipulationTechniques, ...challenge.learningPoints]));
  return (
    <>
      <View style={styles.learningSection}>
        <Text style={styles.sectionLabel}>WHY THIS MATTERED</Text>
        <Text style={styles.explanation}>{challenge.explanation}</Text>
      </View>

      <View style={styles.learningSection}>
        <Text style={styles.sectionLabel}>WHAT TO WATCH FOR</Text>
        <View style={styles.watchList}>
          {watchItems.map((item) => (
            <View key={item} style={styles.watchItem}>
              <Text style={styles.bulletMarker}>•</Text>
              <Text style={styles.bullet}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.ruleCard}>
        <Text style={styles.sectionLabel}>RULE TO REMEMBER</Text>
        <Text style={styles.ruleText}>{challenge.ruleToRemember}</Text>
      </View>
    </>
  );
}

function InspectionDetails({ sourceLabel, domain, rewardLabel }: { sourceLabel?: string; domain?: string; rewardLabel?: string }) {
  return (
    <View style={styles.inspectionCard}>
      <Text style={styles.sectionLabel}>REQUEST ORIGIN</Text>
      <Text style={styles.metaStrong}>{domain ?? sourceLabel ?? 'Unknown source'}</Text>
      <Text style={styles.sectionLabel}>REQUESTED ACTION</Text>
      <Text style={styles.metaStrong}>Sign a message to verify wallet ownership</Text>
      <Text style={styles.sectionLabel}>EXPECTED?</Text>
      <Text style={styles.metaStrong}>No previous reward announcement was shown in TrainRekt</Text>
      <Text style={styles.sectionLabel}>TRANSACTION?</Text>
      <Text style={styles.metaStrong}>No transaction details are presented</Text>
      {rewardLabel ? (
        <>
          <Text style={styles.sectionLabel}>CLAIMED REWARD</Text>
          <Text style={styles.metaStrong}>{rewardLabel}</Text>
        </>
      ) : null}
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} surprise challenge action`} style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]} onPress={onPress}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(9, 11, 16, 0.78)',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 1,
    maxHeight: '90%',
    maxWidth: 520,
    width: '100%',
  },
  contentScroll: {
    flexShrink: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  revealContentContainer: {
    paddingBottom: Spacing.xl,
  },
  ctaFooter: {
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  previewLabel: {
    color: Colors.warning,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  eyebrow: {
    color: Colors.text,
    fontSize: Typography.heading,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  rewardLabel: {
    color: Colors.text,
    fontSize: Typography.heading,
    lineHeight: TypographyLineHeight.heading,
    fontWeight: '900',
    marginTop: Spacing.sm,
  },
  message: {
    color: Colors.secondaryText,
    fontSize: Typography.body,
    lineHeight: TypographyLineHeight.body,
    marginTop: Spacing.sm,
  },
  meta: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    marginTop: Spacing.xs,
  },
  metaStrong: {
    color: Colors.text,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  countdownLabel: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: Spacing.md,
  },
  countdownValue: {
    color: Colors.text,
    fontFamily: 'monospace',
    fontSize: Typography.heading,
    fontWeight: '900',
    marginTop: Spacing.xs,
  },
  inspectionCard: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
    padding: Spacing.md,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  decisionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  decisionLabel: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
    width: 64,
  },
  decisionValue: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  actionButtonPressed: {
    opacity: 0.82,
  },
  actionLabel: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resultCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  resultCardSafe: {
    backgroundColor: 'rgba(50, 213, 131, 0.12)',
    borderColor: Colors.positive,
  },
  resultCardRisky: {
    backgroundColor: 'rgba(249, 112, 102, 0.12)',
    borderColor: Colors.negative,
  },
  resultIcon: {
    fontSize: Typography.heading,
    fontWeight: '900',
  },
  resultSafeText: {
    color: Colors.positive,
  },
  resultRiskyText: {
    color: Colors.negative,
  },
  simulationLabel: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
  },
  resultHeadline: {
    color: Colors.text,
    fontSize: Typography.heading,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },
  resultSummary: {
    color: Colors.text,
    fontSize: Typography.body,
    lineHeight: TypographyLineHeight.body,
    marginTop: Spacing.xs,
  },
  rewardCaption: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: Spacing.md,
  },
  xpValue: {
    color: Colors.text,
    fontSize: Typography.heading,
    lineHeight: TypographyLineHeight.heading,
    fontWeight: '900',
    marginTop: Spacing.xs,
  },
  noBadge: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    marginTop: Spacing.md,
  },
  secondarySection: {
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    marginTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  learningSection: {
    marginTop: Spacing.xl,
  },
  explanation: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
    marginTop: Spacing.xs,
  },
  ruleCard: {
    backgroundColor: Colors.secondaryCard,
    borderRadius: Radius.md,
    marginTop: Spacing.xl,
    padding: Spacing.md,
  },
  ruleText: {
    color: Colors.text,
    fontSize: Typography.body,
    lineHeight: TypographyLineHeight.body,
    marginTop: Spacing.xs,
  },
  sectionLabel: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 1,
  },
  watchList: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  watchItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  bulletMarker: {
    color: Colors.accent,
    fontSize: Typography.body,
    lineHeight: TypographyLineHeight.small,
    marginRight: Spacing.sm,
  },
  bullet: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
  badgeCard: {
    backgroundColor: Colors.secondaryCard,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
    padding: Spacing.md,
  },
  badgeTitle: {
    color: Colors.mutedText,
    fontSize: Typography.label,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  badgeName: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '800',
    marginTop: Spacing.xs,
  },
  badgeDescription: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
    marginTop: Spacing.xs,
  },
  previewCopy: {
    color: Colors.warning,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
    marginTop: Spacing.sm,
  },
});
