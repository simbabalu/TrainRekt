import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, Typography } from '@/constants/theme';

export default function AppTabs() { return <Tabs><TabSlot style={{ height: '100%' }} /><TabList asChild><CustomTabList><TabTrigger name="home" href="/" asChild><TabButton>Home</TabButton></TabTrigger><TabTrigger name="train" href={'/train' as Href} asChild><TabButton>Train</TabButton></TabTrigger><TabTrigger name="progress" href="/explore" asChild><TabButton>Progress</TabButton></TabTrigger><TabTrigger name="settings" href={'/settings' as Href} asChild><TabButton>Settings</TabButton></TabTrigger></CustomTabList></TabList></Tabs>; }
function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) { return <Pressable {...props} style={[styles.tab, isFocused && styles.focused]}><Text style={[styles.tabLabel, isFocused && styles.focusedLabel]}>{children}</Text></Pressable>; }
function CustomTabList(props: TabListProps) { const insets = useSafeAreaInsets(); return <View {...props} style={[styles.tabList, { bottom: insets.bottom }]}>{props.children}</View>; }

const styles = StyleSheet.create({ tabList: { backgroundColor: Colors.card, borderColor: Colors.border, borderTopWidth: 1, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', left: 0, padding: 0, position: 'absolute', right: 0 }, tab: { alignItems: 'center', flex: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: Spacing.xs, paddingVertical: Spacing.md }, focused: { backgroundColor: Colors.secondaryCard }, tabLabel: { color: Colors.secondaryText, fontSize: Typography.body, fontWeight: '700' }, focusedLabel: { color: Colors.text } });