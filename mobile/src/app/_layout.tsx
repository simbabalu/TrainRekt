import { DarkTheme, ThemeProvider } from 'expo-router';
import AppTabs from '@/components/app-tabs';
import { TrainingProgressProvider } from '@/context/TrainingProgressContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return <ThemeProvider value={DarkTheme}><TrainingProgressProvider><SettingsProvider><HydratedApp /></SettingsProvider></TrainingProgressProvider></ThemeProvider>;
}

function HydratedApp() {
  const { isHydrated: progressHydrated } = useTrainingProgress();
  const { isHydrated: settingsHydrated } = useSettings();
  if (!progressHydrated || !settingsHydrated) return <View style={styles.loading}><ActivityIndicator color={Colors.accent} /></View>;
  return <AppTabs />;
}

const styles = StyleSheet.create({ loading: { alignItems: 'center', backgroundColor: Colors.background, flex: 1, justifyContent: 'center' } });
