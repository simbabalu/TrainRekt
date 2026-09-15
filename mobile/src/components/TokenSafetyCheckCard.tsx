import { useRouter, type Href } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { Colors, Typography, TypographyLineHeight } from '@/constants/theme';

export function TokenSafetyCheckCard() {
  const router = useRouter();

  return (
    <SectionCard>
      <Text style={styles.eyebrow}>TOKEN SAFETY CHECK</Text>
      <Text style={styles.description}>Analyze any Solana token before you interact with it.</Text>
      <PrimaryButton
        variant="secondary"
        onPress={() => {
          router.push('/(tabs)/token-analysis' as Href);
        }}
      >
        ANALYZE TOKEN
      </PrimaryButton>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: Colors.text,
    fontSize: Typography.small,
    fontWeight: '900',
    letterSpacing: 1,
  },
  description: {
    color: Colors.secondaryText,
    fontSize: Typography.small,
    lineHeight: TypographyLineHeight.small,
  },
});