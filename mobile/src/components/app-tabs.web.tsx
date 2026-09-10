import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

export default function AppTabs() { return <Tabs><TabSlot style={{ height: '100%' }} /><TabList asChild><CustomTabList><TabTrigger name="home" href="/" asChild><TabButton>Home</TabButton></TabTrigger><TabTrigger name="train" href={'/train' as Href} asChild><TabButton>Train</TabButton></TabTrigger><TabTrigger name="progress" href="/explore" asChild><TabButton>Progress</TabButton></TabTrigger><TabTrigger name="settings" href={'/settings' as Href} asChild><TabButton>Settings</TabButton></TabTrigger></CustomTabList></TabList></Tabs>; }
function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) { return <Pressable {...props} style={[styles.tab, isFocused && styles.focused]}><Text style={[styles.tabLabel, isFocused && styles.focusedLabel]}>{children}</Text></Pressable>; }
function CustomTabList(props: TabListProps) { return <View {...props} style={styles.tabList}>{props.children}</View>; }

const styles = StyleSheet.create({ tabList: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: Radius.lg, borderWidth: 1, bottom: Spacing.lg, flexDirection: 'row', justifyContent: 'space-around', left: Spacing.lg, padding: Spacing.sm, position: 'absolute', right: Spacing.lg }, tab: { alignItems: 'center', borderRadius: Radius.md, flex: 1, paddingVertical: Spacing.md }, focused: { backgroundColor: Colors.secondaryCard }, tabLabel: { color: Colors.secondaryText, fontSize: Typography.small, fontWeight: '700' }, focusedLabel: { color: Colors.text } });