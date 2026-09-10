import { DarkTheme, ThemeProvider } from 'expo-router';
import AppTabs from '@/components/app-tabs';
import { TrainingProgressProvider } from '@/context/TrainingProgressContext';

export default function TabLayout() {
  return <ThemeProvider value={DarkTheme}><TrainingProgressProvider><AppTabs /></TrainingProgressProvider></ThemeProvider>;
}
