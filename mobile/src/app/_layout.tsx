import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { SurpriseChallengeProvider } from '@/context/SurpriseChallengeContext';
import { WalletSafetyInspectionProvider } from '@/context/WalletSafetyInspectionContext';
import { WalletProvider } from '@/context/WalletContext';
import { TrainingProgressProvider } from '@/context/TrainingProgressContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return <ThemeProvider value={DarkTheme}><WalletProvider><WalletSafetyInspectionProvider><TrainingProgressProvider><SurpriseChallengeProvider><SettingsProvider><HydratedApp /></SettingsProvider></SurpriseChallengeProvider></TrainingProgressProvider></WalletSafetyInspectionProvider></WalletProvider></ThemeProvider>;
}

function HydratedApp() {
  const { isHydrated: progressHydrated } = useTrainingProgress();
  const { isHydrated: settingsHydrated } = useSettings();
  if (!progressHydrated || !settingsHydrated) return <View style={styles.loading}><ActivityIndicator color={Colors.accent} /></View>;
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack>;
}

const styles = StyleSheet.create({ loading: { alignItems: 'center', backgroundColor: Colors.background, flex: 1, justifyContent: 'center' } });
