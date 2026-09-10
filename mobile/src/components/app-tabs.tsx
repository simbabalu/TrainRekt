import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  return <NativeTabs backgroundColor={Colors.card} indicatorColor={Colors.accent} labelStyle={{ selected: { color: Colors.text } }}><NativeTabs.Trigger name="index"><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger><NativeTabs.Trigger name="train"><NativeTabs.Trigger.Label>Train</NativeTabs.Trigger.Label></NativeTabs.Trigger><NativeTabs.Trigger name="explore"><NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label></NativeTabs.Trigger><NativeTabs.Trigger name="settings"><NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label></NativeTabs.Trigger></NativeTabs>;
}