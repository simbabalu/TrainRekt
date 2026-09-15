import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { ShareIntentCoordinator } from '@/components/share/ShareIntentCoordinator';
import { SurpriseChallengeProvider } from '@/context/SurpriseChallengeContext';
import { WalletSafetyInspectionProvider } from '@/context/WalletSafetyInspectionContext';
import { WalletProvider } from '@/context/WalletContext';
import { TrainingProgressProvider } from '@/context/TrainingProgressContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { useSettings } from '@/hooks/useSettings';
import { useTrainingProgress } from '@/hooks/useTrainingProgress';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { startupBrandingLogo } from '@/app/startupBrandingLogo';

export default function TabLayout() {
  return <ThemeProvider value={DarkTheme}><WalletProvider><WalletSafetyInspectionProvider><TrainingProgressProvider><SurpriseChallengeProvider><SettingsProvider><HydratedApp /></SettingsProvider></SurpriseChallengeProvider></TrainingProgressProvider></WalletSafetyInspectionProvider></WalletProvider></ThemeProvider>;
}

function HydratedApp() {
  const { isHydrated: progressHydrated } = useTrainingProgress();
  const { isHydrated: settingsHydrated } = useSettings();
  if (!progressHydrated || !settingsHydrated) {
    return (
      <View style={styles.loading}>
        <Image accessibilityLabel="TrainRekt logo" source={startupBrandingLogo} style={styles.logo} />
        <Text style={styles.productName}>TrainRekt</Text>
        <Text style={styles.slogan}>BETTER HUMANS. SAFER SOLANA.</Text>
      </View>
    );
  }
  return <><ShareIntentCoordinator /><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack></>;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#050B18',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    height: 168,
    width: 168,
  },
  productName: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
  },
  slogan: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
  },
});
