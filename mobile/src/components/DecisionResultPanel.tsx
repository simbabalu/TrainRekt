import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography, TypographyLineHeight } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { SkillKey } from '@/types/progress';
import { TrainingExerciseResult } from '@/types/exercise';
import { TrainingMode } from '@/types/training';
import { SectionCard } from './SectionCard';

export function DecisionResultPanel({ result, skill, mode = 'daily', isWalletRetry = false }: { result: TrainingExerciseResult; skill: SkillKey; mode?: TrainingMode; isWalletRetry?: boolean }) {
  return (
    <SectionCard>
      <Text style={[styles.title, result.isCorrect ? styles.positive : styles.negative]}>{result.title}</Text>
      <View style={styles.rewardRow}>
        <View>
          <Text style={styles.xp}>+{result.xpEarned} XP</Text>
          {mode === 'practice' && <Text style={styles.practiceLabel}>PRACTICE XP</Text>}
          {isWalletRetry && <Text style={styles.retryLabel}>RETRY - NO ADDITIONAL XP</Text>}
        </View>
        <Text style={styles.skill}>{skillLabels[skill]} {result.isCorrect ? '+2' : '-1'}</Text>
      </View>
      {result.riskIndicators && result.riskIndicators.length > 0 && (
        <View style={styles.analysisBlock}>
          <Text style={styles.lessonLabel}>RED FLAGS</Text>
          {result.riskIndicators.map((indicator) => <View key={indicator.label} style={styles.analysisRow}><View style={[styles.analysisMarker, styles[indicator.severity]]} /><View style={styles.analysisCopy}><Text style={styles.analysisLabel}>{indicator.label}</Text><Text style={styles.analysisDetail}>{indicator.detail}</Text></View></View>)}
        </View>
      )}
      {result.safeIndicators && result.safeIndicators.length > 0 && (
        <View style={styles.analysisBlock}>
          <Text style={styles.lessonLabel}>SAFE SIGNALS</Text>
          {result.safeIndicators.map((indicator) => <View key={indicator} style={styles.analysisRow}><Text style={styles.safeMarker}>✓</Text><Text style={styles.analysisDetail}>{indicator}</Text></View>)}
        </View>
      )}
      <Text style={styles.lessonLabel}>WHAT TO REMEMBER</Text>
      <Text style={styles.explanation}>{result.explanation}</Text>
      {result.learningPoints && result.learningPoints.length > 0 && (
        <View style={styles.learningPoints}>
          {result.learningPoints.map((point) => <View key={point} style={styles.learningPointRow}><Text style={styles.learningMarker}>•</Text><Text style={styles.learningPoint}>{point}</Text></View>)}
        </View>
      )}
      {result.transactionInspection && (
        <View style={styles.analysisBlock}>
          <Text style={styles.lessonLabel}>TRANSACTION ANALYSIS</Text>
          <Text style={styles.analysisDetail}>Network: {result.transactionInspection.network}</Text>
          <Text style={styles.analysisDetail}>Fee: {result.transactionInspection.feeSol.toFixed(6)} SOL</Text>
          {(result.transactionInspection.requestingApp || result.transactionInspection.requestingDomain) && (
            <Text style={styles.analysisDetail}>Requester: {result.transactionInspection.requestingApp ?? 'Unknown'} ({result.transactionInspection.requestingDomain ?? 'Unknown domain'})</Text>
          )}
          {result.transactionInspection.programInvocations.map((program) => (
            <View key={`${program.program}-${String(program.verified)}`} style={styles.analysisRow}>
              <View style={[styles.analysisMarker, program.verified ? styles.info : styles.caution]} />
              <Text style={styles.analysisDetail}>{program.program} ({program.verified ? 'verified' : 'unverified'})</Text>
            </View>
          ))}
          {result.transactionInspection.ruleToRemember && <Text style={styles.explanation}>{result.transactionInspection.ruleToRemember}</Text>}
        </View>
      )}
      {result.permissionChallenge && (
        <View style={styles.analysisBlock}>
          <Text style={styles.lessonLabel}>PERMISSION ANALYSIS</Text>
          <Text style={styles.analysisDetail}>App: {result.permissionChallenge.appName}</Text>
          <Text style={styles.analysisDetail}>Permission type: {result.permissionChallenge.permissionType}</Text>
          {result.permissionChallenge.riskSignals?.map((signal) => (
            <View key={signal} style={styles.analysisRow}>
              <View style={[styles.analysisMarker, styles.caution]} />
              <Text style={styles.analysisDetail}>{signal}</Text>
            </View>
          ))}
          {result.permissionChallenge.reassuringSignals?.map((signal) => (
            <View key={signal} style={styles.analysisRow}>
              <Text style={styles.safeMarker}>✓</Text>
              <Text style={styles.analysisDetail}>{signal}</Text>
            </View>
          ))}
          {result.permissionChallenge.ruleToRemember && <Text style={styles.explanation}>{result.permissionChallenge.ruleToRemember}</Text>}
        </View>
      )}
      {result.scamDetection ? (
        <View style={styles.analysisBlock}>
          <Text style={styles.lessonLabel}>SCAM DETECTION BREAKDOWN</Text>
          <Text style={styles.analysisDetail}>Source: {result.scamDetection.sourceType}</Text>
          {result.scamDetection.senderOrApp ? <Text style={styles.analysisDetail}>Sender/App: {result.scamDetection.senderOrApp}</Text> : null}
          {result.scamDetection.displayedDomain ? <Text style={styles.analysisDetail}>Displayed domain: {result.scamDetection.displayedDomain}</Text> : null}
          {result.scamDetection.destinationDomain ? <Text style={styles.analysisDetail}>Destination domain: {result.scamDetection.destinationDomain}</Text> : null}
          {result.scamDetection.headline ? <Text style={styles.analysisDetail}>Headline: {result.scamDetection.headline}</Text> : null}

          <Text style={styles.lessonLabel}>Observed Facts</Text>
          {result.scamDetection.neutralFacts.map((fact) => (
            <View key={fact} style={styles.analysisRow}>
              <Text style={styles.bullet}>-</Text>
              <Text style={styles.analysisDetail}>{fact}</Text>
            </View>
          ))}

          {result.scamDetection.riskSignals && result.scamDetection.riskSignals.length > 0 ? (
            <>
              <Text style={styles.lessonLabel}>Risk Signals</Text>
              {result.scamDetection.riskSignals.map((signal) => (
                <View key={`${signal.label}-${signal.detail}`} style={styles.analysisRow}>
                  <Text style={styles.bullet}>-</Text>
                  <Text style={styles.analysisDetail}><Text style={styles.analysisStrong}>{signal.label}: </Text>{signal.detail}</Text>
                </View>
              ))}
            </>
          ) : null}

          {result.scamDetection.reassuringSignals && result.scamDetection.reassuringSignals.length > 0 ? (
            <>
              <Text style={styles.lessonLabel}>Reassuring Signals</Text>
              {result.scamDetection.reassuringSignals.map((signal) => (
                <View key={`${signal.label}-${signal.detail}`} style={styles.analysisRow}>
                  <Text style={styles.bullet}>-</Text>
                  <Text style={styles.analysisDetail}><Text style={styles.analysisStrong}>{signal.label}: </Text>{signal.detail}</Text>
                </View>
              ))}
            </>
          ) : null}

          {result.scamDetection.ruleToRemember ? <Text style={styles.explanation}>{result.scamDetection.ruleToRemember}</Text> : null}
        </View>
      ) : null}
      {result.redFlagIdentification ? (
        <View style={styles.analysisBlock}>
          <Text style={styles.lessonLabel}>RED FLAG IDENTIFICATION</Text>
          <Text style={styles.analysisDetail}>Accuracy: {result.redFlagIdentification.accuracyPercent}%</Text>
          <Text style={styles.analysisDetail}>Correct selections: {result.redFlagIdentification.selectedCorrectCount}</Text>
          <Text style={styles.analysisDetail}>Missed: {result.redFlagIdentification.missedCount}</Text>
          <Text style={styles.analysisDetail}>False positives: {result.redFlagIdentification.falsePositiveCount}</Text>

          <Text style={styles.lessonLabel}>CORRECT RED FLAGS</Text>
          {result.redFlagIdentification.correctRedFlags.length === 0 ? (
            <Text style={styles.analysisDetail}>None</Text>
          ) : (
            result.redFlagIdentification.correctRedFlags.map((item) => (
              <View key={item.id} style={styles.analysisRow}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.analysisDetail}><Text style={styles.analysisStrong}>{item.label}: </Text>{item.detail}</Text>
              </View>
            ))
          )}

          <Text style={styles.lessonLabel}>MISSED RED FLAGS</Text>
          {result.redFlagIdentification.missedRedFlags.length === 0 ? (
            <Text style={styles.analysisDetail}>None</Text>
          ) : (
            result.redFlagIdentification.missedRedFlags.map((item) => (
              <View key={item.id} style={styles.analysisRow}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.analysisDetail}><Text style={styles.analysisStrong}>{item.label}: </Text>{item.detail}</Text>
              </View>
            ))
          )}

          <Text style={styles.lessonLabel}>FALSE POSITIVES</Text>
          {result.redFlagIdentification.falsePositives.length === 0 ? (
            <Text style={styles.analysisDetail}>None</Text>
          ) : (
            result.redFlagIdentification.falsePositives.map((item) => (
              <View key={item.id} style={styles.analysisRow}>
                <Text style={styles.bullet}>-</Text>
                <Text style={styles.analysisDetail}><Text style={styles.analysisStrong}>{item.label}: </Text>{item.detail}</Text>
              </View>
            ))
          )}

          {result.redFlagIdentification.ruleToRemember ? <Text style={styles.explanation}>{result.redFlagIdentification.ruleToRemember}</Text> : null}
        </View>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Typography.heading, fontWeight: '800', textTransform: 'uppercase' },
  rewardRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  xp: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  practiceLabel: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1 },
  retryLabel: { color: Colors.secondaryText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  explanation: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: TypographyLineHeight.body, marginTop: Spacing.sm },
  skill: { color: Colors.accent, fontSize: Typography.small, fontWeight: '800' },
  lessonLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2, marginTop: Spacing.lg },
  learningPoints: { gap: Spacing.sm, marginTop: Spacing.md },
  learningPointRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.sm },
  learningMarker: { color: Colors.accent, fontSize: Typography.body, fontWeight: '900', lineHeight: TypographyLineHeight.body },
  learningPoint: { color: Colors.secondaryText, flex: 1, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  analysisBlock: { gap: Spacing.sm },
  analysisRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.sm },
  analysisMarker: { borderRadius: 999, height: Spacing.sm, marginTop: Spacing.xs, width: Spacing.sm },
  danger: { backgroundColor: Colors.negative },
  caution: { backgroundColor: Colors.warning },
  info: { backgroundColor: Colors.accent },
  safeMarker: { color: Colors.positive, fontSize: Typography.body, fontWeight: '900', lineHeight: TypographyLineHeight.body },
  analysisCopy: { flex: 1 },
  analysisLabel: { color: Colors.text, fontSize: Typography.small, fontWeight: '800' },
  analysisDetail: { color: Colors.secondaryText, flex: 1, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  analysisStrong: { color: Colors.text, fontWeight: '800' },
  bullet: { color: Colors.secondaryText, fontSize: Typography.small, lineHeight: TypographyLineHeight.small },
  positive: { color: Colors.positive },
  negative: { color: Colors.negative },
});