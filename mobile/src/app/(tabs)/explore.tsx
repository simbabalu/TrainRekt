import { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';

import { LevelProgressCard } from '@/components/LevelProgressCard';
import { PageHeading } from '@/components/PageHeading';
import { ProgressBar } from '@/components/ProgressBar';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { getEarnedAchievements } from '@/domain/progress/getEarnedAchievements';
import { summarizeProgressSkills } from '@/domain/progress/summarizeProgressSkills';
import { calculateDailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { SkillKey } from '@/types/progress';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

const skillKeys: SkillKey[] = ['riskManagement', 'profitTaking', 'fomoResistance', 'positionSizing', 'scamAwareness', 'leverageRisk', 'panicSelling', 'marketInterpretation', 'walletSafety'];

const statusIcon: Record<'correct' | 'wrong', AppIconName> = {
  correct: { ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' },
  wrong: { ios: 'xmark.circle', android: 'cancel', web: 'cancel' },
};

function SectionHeader({ title, iconName, iconLabel }: { title: string; iconName: AppIconName; iconLabel: string }) {
  return <View style={styles.sectionHeader}><AppIcon accessibilityLabel={iconLabel} name={iconName} badge /><Text style={styles.sectionTitle}>{title}</Text></View>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const { progress } = useTrainingProgress();
  const [showAllSkills, setShowAllSkills] = useState(false);
  const dailyGoalProgress = calculateDailyGoalProgress(progress.daily);
  const skillSummary = summarizeProgressSkills(progress.skillScores, progress.recentTrainingHistory);
  const achievements = getEarnedAchievements(progress.badges);
  const recentEntries = progress.recentTrainingHistory.slice(0, 3);

  return (
    <Screen>
      <PageHeading eyebrow="PROGRESS" title="Your training progress" />

      <LevelProgressCard summary={progress} totalXp={progress.totalXp} />

      <SectionCard>
        <SectionHeader title="TRAINING OVERVIEW" iconName={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }} iconLabel="Training overview" />
        <View style={styles.metricGrid}>
          <Metric value={String(progress.sessionsCompleted)} label="Decisions" />
          <Metric value={`${progress.winRate}%`} label="Accuracy" />
          <Metric value={String(progress.currentStreak)} label="Current streak" />
          <Metric value={String(progress.bestStreak)} label="Best streak" />
        </View>
        <Text style={styles.secondaryInfo}>Correct: {progress.correctDecisions}  •  Wrong: {progress.wrongDecisions}</Text>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="YOUR SKILLS" iconName={{ ios: 'scope', android: 'target', web: 'target' }} iconLabel="Skills" />
        {!showAllSkills && (
          <View style={styles.skillsSummary}>
            {skillSummary.trainedSkills.length === 0 ? (
              <Text style={styles.notTrainedText}>Not trained yet</Text>
            ) : (
              <>
                <View style={styles.skillsBlock}>
                  <Text style={styles.skillsBlockTitle}>Strongest</Text>
                  {skillSummary.strongestSkills.map((entry) => (
                    <View key={entry.skill} style={styles.skillRow}>
                      <Text style={styles.skillName}>{entry.label}</Text>
                      <Text style={styles.skillScore}>{entry.score}%</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.skillsBlock}>
                  <Text style={styles.skillsBlockTitle}>Needs Practice</Text>
                  {skillSummary.needsPracticeSkills.length > 0 ? skillSummary.needsPracticeSkills.map((entry) => (
                    <View key={entry.skill} style={styles.skillRow}>
                      <Text style={styles.skillName}>{entry.label}</Text>
                      <Text style={styles.skillScore}>{entry.score}%</Text>
                    </View>
                  )) : <Text style={styles.secondaryInfo}>No additional trained skills yet.</Text>}
                </View>
              </>
            )}
          </View>
        )}

        {showAllSkills && (
          <View style={styles.skillsExpanded}>
            {skillKeys.map((skill) => {
              const entry = skillSummary.allSkills.find((item) => item.skill === skill);
              if (!entry) return null;
              return (
                <View key={skill} style={styles.skillExpandedRow}>
                  {entry.trained
                    ? <ProgressBar label={entry.label} percentage={entry.score} />
                    : <View style={styles.untrainedRow}><Text style={styles.skillName}>{entry.label}</Text><Text style={styles.notTrainedText}>Not trained yet</Text></View>}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.skillsButton}>
          <PrimaryButton variant="secondary" onPress={() => setShowAllSkills((value) => !value)}>
            {showAllSkills ? 'SHOW LESS' : 'VIEW ALL SKILLS'}
          </PrimaryButton>
        </View>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="DAILY TRAINING" iconName={{ ios: 'calendar.badge.checkmark', android: 'event_available', web: 'event_available' }} iconLabel="Daily training" />
        <View style={styles.metricGridCompact}>
          <Metric value={`${dailyGoalProgress.completed}/${dailyGoalProgress.goal}`} label="Today" />
          <Metric value={`${progress.daily.dailyTrainingStreak}`} label="Day streak" />
          <Metric value={`${progress.daily.bestDailyTrainingStreak}`} label="Best" />
        </View>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="ACHIEVEMENTS" iconName={{ ios: 'rosette', android: 'military_tech', web: 'military_tech' }} iconLabel="Achievements" />
        {achievements.length === 0 ? (
          <Text style={styles.secondaryInfo}>No achievements earned yet.</Text>
        ) : (
          <View style={styles.achievementsList}>
            {achievements.map((achievement) => (
              <View key={achievement.id} style={styles.achievementCard}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>{achievement.description}</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <SectionHeader title="RECENT TRAINING" iconName={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }} iconLabel="Recent training" />
        {recentEntries.length === 0 ? (
          <Text style={styles.secondaryInfo}>No recent training yet.</Text>
        ) : (
          <View style={styles.history}>
            {recentEntries.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <AppIcon
                  accessibilityLabel="Training history entry"
                  name={entry.correct ? statusIcon.correct : statusIcon.wrong}
                  size={16}
                  tintColor={entry.correct ? Colors.positive : Colors.negative}
                />
                <View style={styles.historyMain}>
                  <Text style={styles.historyTitle}>{entry.scenarioTitle}</Text>
                  <Text style={[styles.historyResult, entry.correct ? styles.positive : styles.negative]}>{entry.correct ? 'Correct' : 'Wrong'}  •  {skillLabels[entry.skill]}</Text>
                </View>
                <Text style={styles.historyXp}>+{entry.xpEarned} XP</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.md },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md, rowGap: Spacing.md },
  metricGridCompact: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md, rowGap: Spacing.md },
  metric: { minWidth: '33%', paddingRight: Spacing.md },
  metricValue: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  metricLabel: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  secondaryInfo: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.md },
  skillsSummary: { gap: Spacing.md, marginTop: Spacing.md },
  skillsExpanded: { gap: Spacing.md, marginTop: Spacing.md },
  skillsBlock: { gap: Spacing.sm },
  skillsBlockTitle: { color: Colors.accent, fontSize: Typography.label, fontWeight: '900', letterSpacing: 0.8 },
  skillRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  skillName: { color: Colors.text, flex: 1, fontSize: Typography.body, fontWeight: '700', paddingRight: Spacing.md },
  skillScore: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' },
  skillExpandedRow: { gap: Spacing.sm },
  untrainedRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  notTrainedText: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
  skillsButton: { marginTop: Spacing.lg },
  achievementsList: { gap: Spacing.sm, marginTop: Spacing.md },
  achievementCard: { backgroundColor: Colors.secondaryCard, borderColor: Colors.border, borderRadius: 12, borderWidth: 1, padding: Spacing.md },
  achievementTitle: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' },
  achievementDescription: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  history: { gap: Spacing.md, marginTop: Spacing.md },
  historyRow: { alignItems: 'center', flexDirection: 'row' },
  historyMain: { flex: 1, paddingRight: Spacing.md },
  historyTitle: { color: Colors.text, fontSize: Typography.body, fontWeight: '700' },
  historyResult: { fontSize: Typography.small, fontWeight: '700', marginTop: Spacing.xs },
  historyXp: { color: Colors.text, fontSize: Typography.body, fontWeight: '800', marginLeft: Spacing.sm },
  positive: { color: Colors.positive },
  negative: { color: Colors.negative },
});