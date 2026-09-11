import { forwardRef, PropsWithChildren } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { Colors, Spacing } from '@/constants/theme';

export const Screen = forwardRef<ScrollView, PropsWithChildren>(function Screen({ children }, ref) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView ref={ref} contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safe: { backgroundColor: Colors.background, flex: 1 },
  content: { gap: Spacing.md, padding: Spacing.lg, paddingBottom: 110 },
});