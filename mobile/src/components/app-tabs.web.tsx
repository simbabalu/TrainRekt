import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { AppIcon, type AppIconName } from '@/components/AppIcon';

const tabIcons: Record<string, AppIconName> = {
	Home: { ios: 'house.fill', android: 'home', web: 'home' },
	Train: { ios: 'graduationcap.fill', android: 'school', web: 'school' },
	Progress: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
	Settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
};

export default function AppTabs() { return <Tabs><TabSlot style={styles.tabSlot} /><TabList asChild><CustomTabList><TabTrigger name="home" href="/" asChild><TabButton>Home</TabButton></TabTrigger><TabTrigger name="train" href={'/train' as Href} asChild><TabButton>Train</TabButton></TabTrigger><TabTrigger name="progress" href="/explore" asChild><TabButton>Progress</TabButton></TabTrigger><TabTrigger name="settings" href={'/settings' as Href} asChild><TabButton>Settings</TabButton></TabTrigger><TabTrigger name="wallet-safety" href={'/wallet-safety' as Href} asChild><Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.hiddenTab} /></TabTrigger></CustomTabList></TabList></Tabs>; }
function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) { const label = String(children); return <Pressable {...props} accessibilityLabel={label} style={[styles.tab, isFocused && styles.focused]}><AppIcon accessibilityLabel={`${label} tab`} name={tabIcons[label]} size={20} tintColor={isFocused ? Colors.accent : Colors.mutedText} /><Text style={[styles.tabLabel, isFocused && styles.focusedLabel]}>{children}</Text></Pressable>; }
function CustomTabList(props: TabListProps) { const insets = useSafeAreaInsets(); return <View {...props} style={[styles.tabList, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>{props.children}</View>; }

const styles = StyleSheet.create({ tabSlot: { height: '100%', paddingBottom: 80 }, tabList: { backgroundColor: Colors.card, borderColor: Colors.border, borderTopWidth: 1, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', left: 0, minHeight: 80, paddingHorizontal: 0, paddingTop: 0, position: 'absolute', right: 0 }, tab: { alignItems: 'center', flex: 1, minHeight: 64, justifyContent: 'center', paddingHorizontal: Spacing.xs, paddingVertical: Spacing.sm }, hiddenTab: { display: 'none' }, focused: { backgroundColor: Colors.secondaryCard }, tabLabel: { color: Colors.secondaryText, fontSize: Typography.body, fontWeight: '700' }, focusedLabel: { color: Colors.text } });