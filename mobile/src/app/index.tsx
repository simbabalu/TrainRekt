import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { mockScenarios } from '@/data/mockScenarios';

export default function HomeScreen() {
  const challenge = mockScenarios[0];

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>TrainRekt</Text>
          <Text style={styles.subtitle}>Learn trading by surviving bad decisions.</Text>
        </View>
        <View style={styles.level}>
          <Text style={styles.levelNumber}>7</Text>
          <Text style={styles.levelLabel}>LEVEL</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your training desk</Text>
      <View style={styles.stats}>
        <StatCard label="Training Score" value="742" detail="Intermediate" />
        <StatCard label="Sessions completed" value="12" />
        <StatCard label="Win rate" value="58%" />
        <StatCard label="Current streak" value="4 days" />
      </View>

      <Link href={'/train' as Href} asChild>
        <View>
          <PrimaryButton onPress={() => undefined}>START TRAINING</PrimaryButton>
        </View>
      </Link>

      <View style={styles.challengeHeading}>
        <Text style={styles.sectionTitle}>Today&apos;s challenge</Text>
        <Text style={styles.reward}>+{challenge.reward} XP</Text>
      </View>
      <SectionCard>
        <Text style={styles.challengeTitle}>{challenge.title}</Text>
        <Text style={styles.challengeDescription}>Read the market, manage risk, and make your next move.</Text>
        <View style={styles.challengeMeta}>
          <Text style={styles.meta}>{challenge.difficulty}</Text>
          <Text style={styles.meta}>{challenge.duration}</Text>
          <Text style={styles.meta}>Reward +{challenge.reward} XP</Text>
        </View>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md },
  brand: { color: Colors.text, fontSize: Typography.title, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Colors.secondaryText, fontSize: Typography.small, marginTop: Spacing.xs },
  level: { alignItems: 'center', backgroundColor: Colors.secondaryCard, borderColor: Colors.border, borderRadius: Radius.md, borderWidth: 1, minWidth: 54, padding: Spacing.sm },
  levelNumber: { color: Colors.accent, fontSize: Typography.heading, fontWeight: '900' },
  levelLabel: { color: Colors.mutedText, fontSize: 9, fontWeight: '800' },
  sectionTitle: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  challengeHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  reward: { color: Colors.positive, fontSize: Typography.body, fontWeight: '800' },
  challengeTitle: { color: Colors.text, fontSize: Typography.heading, fontWeight: '800' },
  challengeDescription: { color: Colors.secondaryText, fontSize: Typography.body, lineHeight: 22, marginTop: Spacing.sm },
  challengeMeta: { borderTopColor: Colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg, paddingTop: Spacing.md },
  meta: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' },
});