import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DailyGoalCard } from '@/components/DailyGoalCard';
import { LevelProgressCard } from '@/components/LevelProgressCard';
import { PageHeading } from '@/components/PageHeading';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { TodayTrainingCard } from '@/components/TodayTrainingCard';
import { TrainingSummary } from '@/components/TrainingSummary';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { skillLabels } from '@/constants/training';
import { calculateDailyGoalProgress } from '@/domain/training/calculateDailyGoalProgress';
import { getHomeTrainingCta } from '@/domain/training/getHomeTrainingCta';
import { getWeakestSkills } from '@/domain/training/getWeakestSkills';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { useRecommendedTraining } from '@/hooks/useRecommendedTraining';
import { SkillKey } from '@/types/progress';

export default function HomeScreen() {
  const { progress } = useTrainingProgress();
  const trainingExercise = useRecommendedTraining();
  const previewSkills: SkillKey[] = getWeakestSkills(progress.skillScores).slice(0, 2).map((entry) => entry.skill);
  const dailyGoalProgress = calculateDailyGoalProgress(progress.daily);
  const trainingCta = getHomeTrainingCta(dailyGoalProgress);

  return (
    <Screen>
      <PageHeading eyebrow="TRAINREKT" title="Train your crypto decisions" subtitle="Before they cost real money." />
      <LevelProgressCard summary={progress} totalXp={progress.totalXp} />
      <TrainingSummary progress={progress} />
      <DailyGoalCard goalProgress={dailyGoalProgress} dailyTrainingStreak={progress.daily.dailyTrainingStreak} />
      <Link href={{ pathname: '/train', params: { mode: trainingCta.mode } } as Href} asChild>
        <PrimaryButton variant={trainingCta.mode === 'practice' ? 'secondary' : 'primary'} onPress={() => undefined}>{trainingCta.label}</PrimaryButton>
      </Link>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>TODAY&apos;S TRAINING</Text><Text style={styles.sectionHint}>One decision at a time</Text></View>
      <TodayTrainingCard exercise={trainingExercise} />
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>YOUR SKILLS</Text><Text style={styles.sectionHint}>Keep building</Text></View>
      <View style={styles.skills}>{previewSkills.map((skill) => <View key={skill} style={styles.skillRow}><Text style={styles.skillName}>{skillLabels[skill]}</Text><Text style={styles.skillScore}>{progress.skillScores[skill]}%</Text></View>)}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  sectionTitle: { color: Colors.text, fontSize: Typography.small, fontWeight: '900', letterSpacing: 1.2 },
  sectionHint: { color: Colors.mutedText, fontSize: Typography.small },
  skills: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.md, padding: Spacing.lg },
  skillRow: { flexDirection: 'row', justifyContent: 'space-between' },
  skillName: { color: Colors.secondaryText, fontSize: Typography.body },
  skillScore: { color: Colors.text, fontSize: Typography.body, fontWeight: '800' },
});