import { forwardRef, PropsWithChildren } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { BottomTabInset, Colors, LayoutSpacing } from '@/constants/theme';

export const Screen = forwardRef<ScrollView, PropsWithChildren>(function Screen({ children }, ref) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        ref={ref}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: BottomTabInset + LayoutSpacing.pageBottomInset + insets.bottom },
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safe: { backgroundColor: Colors.background, flex: 1 },
  content: {
    gap: LayoutSpacing.pageSectionGap,
    paddingHorizontal: LayoutSpacing.pageHorizontal,
    paddingTop: LayoutSpacing.pageTop,
  },
});