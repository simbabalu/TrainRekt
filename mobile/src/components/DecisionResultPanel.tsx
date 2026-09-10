import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { SkillKey } from '@/types/progress';
import { TrainingExerciseResult } from '@/types/exercise';
import { SectionCard } from './SectionCard';

export function DecisionResultPanel({ result, skill }: { result: TrainingExerciseResult; skill: SkillKey }) {
  return (
    <SectionCard>
      <Text style={[styles.title, result.isCorrect ? styles.positive : styles.negative]}>{result.title}</Text>
      <View style={styles.rewardRow}>
        <Text style={styles.xp}>+{result.xpEarned} XP</Text>
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
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: Typography.heading, fontWeight: '800', textTransform: 'uppercase' },
  rewardRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  xp: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  explanation: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 22, marginTop: Spacing.sm },
  skill: { color: Colors.accent, fontSize: Typography.small, fontWeight: '800' },
  lessonLabel: { color: Colors.mutedText, fontSize: Typography.label, fontWeight: '900', letterSpacing: 1.2, marginTop: Spacing.lg },
  learningPoints: { gap: Spacing.sm, marginTop: Spacing.md },
  learningPointRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.sm },
  learningMarker: { color: Colors.accent, fontSize: Typography.body, fontWeight: '900', lineHeight: 20 },
  learningPoint: { color: Colors.secondaryText, flex: 1, fontSize: Typography.small, lineHeight: 20 },
  analysisBlock: { gap: Spacing.sm },
  analysisRow: { alignItems: 'flex-start', flexDirection: 'row', gap: Spacing.sm },
  analysisMarker: { borderRadius: 999, height: Spacing.sm, marginTop: Spacing.xs, width: Spacing.sm },
  danger: { backgroundColor: Colors.negative },
  caution: { backgroundColor: Colors.warning },
  info: { backgroundColor: Colors.accent },
  safeMarker: { color: Colors.positive, fontSize: Typography.body, fontWeight: '900', lineHeight: 20 },
  analysisCopy: { flex: 1 },
  analysisLabel: { color: Colors.text, fontSize: Typography.small, fontWeight: '800' },
  analysisDetail: { color: Colors.secondaryText, flex: 1, fontSize: Typography.small, lineHeight: 20 },
  positive: { color: Colors.positive },
  negative: { color: Colors.negative },
});